import 'dart:math';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

/// Override at build time: flutter run --dart-define=API_URL=http://10.0.2.2:4000/api/v1
const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://api.shop.fawadiqbal.dev/api/v1');

class ApiError implements Exception {
  ApiError(this.message, [this.status]);
  final String message;
  final int? status;
  @override
  String toString() => message;
}

/// Thin client for the NestJS API: unwraps { success, data }, sends the access token,
/// refreshes it once on 401, and keeps the guest cart cookie between launches.
class Api {
  Api._(this._dio);
  final Dio _dio;
  static const _storage = FlutterSecureStorage();
  String? _access;
  String? _refresh;
  String? _cart; // guest cart id → X-Cart-Session (cookies are unreliable on web / LAN)

  static String _uuid() {
    final r = Random.secure();
    final b = List<int>.generate(16, (_) => r.nextInt(256));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
    return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
  }

  Future<String> _cartId() async {
    if (_cart != null) return _cart!;
    _cart = await _storage.read(key: 'cart');
    if (_cart == null) {
      _cart = _uuid();
      await _storage.write(key: 'cart', value: _cart);
    }
    return _cart!;
  }

  static Future<Api> create() async {
    final dio = Dio(BaseOptions(
      baseUrl: apiUrl,
      connectTimeout: const Duration(seconds: 15),
      // Web: the browser keeps the cart cookie itself; it just has to be sent cross-origin.
      extra: kIsWeb ? {'withCredentials': true} : null,
    ));
    if (!kIsWeb) {
      final dir = await getApplicationDocumentsDirectory();
      dio.interceptors.add(CookieManager(PersistCookieJar(storage: FileStorage('${dir.path}/.cookies/'))));
    }
    final api = Api._(dio);
    api._access = await _storage.read(key: 'access');
    api._refresh = await _storage.read(key: 'refresh');
    return api;
  }

  bool get signedIn => _refresh != null;

  Future<void> saveTokens(Map<String, dynamic> t) async {
    _access = t['accessToken'] as String?;
    _refresh = t['refreshToken'] as String?;
    await _storage.write(key: 'access', value: _access);
    await _storage.write(key: 'refresh', value: _refresh);
  }

  Future<void> clearTokens() async {
    _access = _refresh = _cart = null; // signed out → fresh guest cart
    await _storage.deleteAll();
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _send('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body ?? {});
  Future<dynamic> patch(String path, Object body) => _send('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, dynamic>? query, bool retried = false}) async {
    try {
      final res = await _dio.request<dynamic>(
        path,
        data: body,
        queryParameters: query?..removeWhere((_, v) => v == null),
        options: Options(method: method, headers: {
          if (_access != null) 'Authorization': 'Bearer $_access',
          'X-Cart-Session': await _cartId(),
        }),
      );
      final data = res.data;
      return data is Map && data.containsKey('data') ? data['data'] : data;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 401 && !retried && _refresh != null && !path.startsWith('/auth/')) {
        if (await _refreshTokens()) return _send(method, path, body: body, query: query, retried: true);
      }
      final msg = e.response?.data is Map ? e.response!.data['message'] : null;
      throw ApiError(msg is List ? msg.join(', ') : (msg?.toString() ?? 'Network error, please try again'), status);
    }
  }

  Future<bool> _refreshTokens() async {
    try {
      final res = await _dio.post<dynamic>('/auth/refresh', data: {'refreshToken': _refresh});
      await saveTokens(Map<String, dynamic>.from(res.data['data'] as Map));
      return true;
    } catch (_) {
      await clearTokens();
      return false;
    }
  }
}
