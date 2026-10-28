import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api.dart';
import 'models.dart';

/// Created in main() before runApp.
final apiProvider = Provider<Api>((_) => throw UnimplementedError());

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final list = await ref.read(apiProvider).get('/catalog/categories') as List;
  return list.map((c) => Category(Map<String, dynamic>.from(c))).toList();
});

/// Product list for a query (sort, category, onSale…); the key is a query-string-like map.
final productsProvider = FutureProvider.family<List<ProductCard>, Map<String, String>>((ref, q) async {
  final res = await ref.read(apiProvider).get('/catalog/products', query: {...q}) as Map;
  return (res['items'] as List).map((p) => ProductCard(Map<String, dynamic>.from(p))).toList();
});

final productProvider = FutureProvider.family<ProductDetail, String>((ref, slug) async {
  return ProductDetail(Map<String, dynamic>.from(await ref.read(apiProvider).get('/catalog/products/$slug') as Map));
});

/// Cart (guest via cookie, or the signed-in customer's).
class CartNotifier extends AsyncNotifier<Map<String, dynamic>> {
  Api get _api => ref.read(apiProvider);
  @override
  Future<Map<String, dynamic>> build() async => Map<String, dynamic>.from(await _api.get('/cart') as Map);
  Future<void> _run(Future<dynamic> f) async => state = AsyncData(Map<String, dynamic>.from(await f as Map));
  Future<void> add(String variantId, [int qty = 1]) => _run(_api.post('/cart/items', {'variantId': variantId, 'quantity': qty}));
  Future<void> setQty(String itemId, int qty) => _run(_api.patch('/cart/items/$itemId', {'quantity': qty}));
  Future<void> remove(String itemId) => _run(_api.delete('/cart/items/$itemId'));
}

final cartProvider = AsyncNotifierProvider<CartNotifier, Map<String, dynamic>>(CartNotifier.new);

/// Signed-in user (null for guests).
class SessionNotifier extends AsyncNotifier<Map<String, dynamic>?> {
  Api get _api => ref.read(apiProvider);
  @override
  Future<Map<String, dynamic>?> build() async {
    if (!_api.signedIn) return null;
    try {
      return Map<String, dynamic>.from(await _api.get('/users/me') as Map);
    } catch (_) {
      return null;
    }
  }

  Future<void> login(String email, String password) async {
    final tokens = await _api.post('/auth/login', {'email': email, 'password': password});
    await _api.saveTokens(Map<String, dynamic>.from(tokens as Map));
    ref.invalidateSelf();
    ref.invalidate(cartProvider); // the guest cart merges into the account
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {}
    await _api.clearTokens();
    state = const AsyncData(null);
    ref.invalidate(cartProvider);
  }
}

final sessionProvider = AsyncNotifierProvider<SessionNotifier, Map<String, dynamic>?>(SessionNotifier.new);
