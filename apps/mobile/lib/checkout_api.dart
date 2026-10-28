import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers.dart';

/// NestJS checkout endpoints (same contract as the web store: packages/types PlaceOrderInput).
///   POST /checkout/quote   → totals, delivery options per seller, payment options
///   POST /checkout/place   → { order, payment? }  (payment.redirectUrl for card/wallet)
///   GET  /users/me/addresses, GET /orders/:number, POST /orders/track
class CheckoutApi {
  CheckoutApi(this.ref);
  final Ref ref;

  Future<Map<String, dynamic>> quote(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(await ref.read(apiProvider).post('/checkout/quote', body) as Map);

  Future<Map<String, dynamic>> place(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(await ref.read(apiProvider).post('/checkout/place', body) as Map);

  Future<List<Map<String, dynamic>>> addresses() async =>
      ((await ref.read(apiProvider).get('/users/me/addresses')) as List).map((a) => Map<String, dynamic>.from(a)).toList();

  Future<Map<String, dynamic>> order(String number, {String? email}) async {
    final api = ref.read(apiProvider);
    final res = email != null && !api.signedIn
        ? await api.post('/orders/track', {'orderNumber': number, 'email': email})
        : await api.get('/orders/${Uri.encodeComponent(number)}');
    return Map<String, dynamic>.from(res as Map);
  }
}

final checkoutApiProvider = Provider((ref) => CheckoutApi(ref));

final addressesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  if (!ref.read(apiProvider).signedIn) return [];
  return ref.read(checkoutApiProvider).addresses();
});

/// Random id per checkout attempt — a double tap never creates two orders.
String newIdempotencyKey() {
  final r = Random.secure();
  return List.generate(24, (_) => r.nextInt(16).toRadixString(16)).join();
}
