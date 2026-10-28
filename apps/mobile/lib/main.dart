import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'api.dart';
import 'providers.dart';
import 'screens/account.dart';
import 'screens/cart.dart';
import 'screens/catalog.dart';
import 'screens/checkout.dart';
import 'screens/home.dart';
import 'screens/order.dart';
import 'screens/me.dart';
import 'screens/search.dart';
import 'screens/order_actions.dart';
import 'screens/product.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = await Api.create();
  runApp(ProviderScope(overrides: [apiProvider.overrideWithValue(api)], child: const App()));
}

final _router = GoRouter(routes: [
  StatefulShellRoute.indexedStack(
    builder: (context, state, shell) => _Shell(shell),
    branches: [
      StatefulShellBranch(routes: [GoRoute(path: '/', builder: (_, __) => const HomeScreen())]),
      StatefulShellBranch(routes: [GoRoute(path: '/categories', builder: (_, __) => const CategoriesScreen())]),
      StatefulShellBranch(routes: [GoRoute(path: '/cart', builder: (_, __) => const CartScreen())]),
      StatefulShellBranch(routes: [GoRoute(path: '/account', builder: (_, __) => const AccountScreen())]),
    ],
  ),
  GoRoute(path: '/product/:slug', builder: (_, s) => ProductScreen(slug: s.pathParameters['slug']!)),
  GoRoute(
    path: '/products',
    builder: (_, s) => ProductListScreen(title: s.uri.queryParameters['title'] ?? 'Products', query: {
      for (final e in s.uri.queryParameters.entries)
        if (e.key != 'title') e.key: e.value,
    }),
  ),
  GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
  GoRoute(path: '/account/orders', builder: (_, __) => const OrdersScreen()),
  GoRoute(path: '/account/wishlist', builder: (_, __) => const WishlistScreen()),
  GoRoute(path: '/account/points', builder: (_, __) => const PointsScreen()),
  GoRoute(path: '/account/addresses', builder: (_, __) => const AddressesScreen()),
  GoRoute(path: '/account/profile', builder: (_, __) => const ProfileScreen()),
  GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
  GoRoute(path: '/checkout', builder: (_, __) => const CheckoutScreen()),
  GoRoute(
    path: '/order/:number',
    builder: (_, s) => OrderScreen(
      number: s.pathParameters['number']!,
      email: s.uri.queryParameters['email'],
      paying: s.uri.queryParameters['paying'] == '1',
    ),
  ),
]);

class App extends StatelessWidget {
  const App({super.key});
  @override
  Widget build(BuildContext context) =>
      MaterialApp.router(title: 'Ecommerce', theme: buildTheme(), routerConfig: _router, debugShowCheckedModeBanner: false);
}

class _Shell extends ConsumerWidget {
  const _Shell(this.shell);
  final StatefulNavigationShell shell;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartProvider).valueOrNull?['itemCount'] as int? ?? 0;
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
          const NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view_rounded), label: 'Categories'),
          NavigationDestination(
            icon: Badge(isLabelVisible: count > 0, backgroundColor: Brand.yellow, textColor: Brand.ink, label: Text('$count'), child: const Icon(Icons.shopping_cart_outlined)),
            selectedIcon: const Icon(Icons.shopping_cart_rounded),
            label: 'Cart',
          ),
          const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person_rounded), label: 'Account'),
        ],
      ),
    );
  }
}
