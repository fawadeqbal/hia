import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';

/// Live suggestions from NestJS GET /search/suggest; submit → product list with ?q=.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchState();
}

class _SearchState extends ConsumerState<SearchScreen> {
  final _q = TextEditingController();
  Timer? _debounce;
  Map<String, dynamic>? _s;
  String? _didYouMean;

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    super.dispose();
  }

  void _changed(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      final q = v.trim();
      if (q.length < 2) return setState(() => {_s = null, _didYouMean = null});
      try {
        final api = ref.read(apiProvider);
        final res = Map<String, dynamic>.from(await api.get('/search/suggest', query: {'q': q}) as Map);
        String? dym;
        if ((res['products'] as List).isEmpty) {
          dym = (await api.get('/search/did-you-mean', query: {'q': q}) as Map)['suggestion'] as String?;
        }
        if (mounted && _q.text.trim() == q) setState(() => {_s = res, _didYouMean = dym});
      } catch (_) {}
    });
  }

  void _go(String q) {
    if (q.trim().isEmpty) return;
    context.push('/products?q=${Uri.encodeQueryComponent(q.trim())}&title=${Uri.encodeQueryComponent('"${q.trim()}"')}');
  }

  Widget _head(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
        child: Text(t, style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.muted, fontSize: 12)),
      );

  @override
  Widget build(BuildContext context) {
    final s = _s;
    final products = (s?['products'] as List?) ?? [];
    final cats = (s?['categories'] as List?) ?? [];
    final brands = (s?['brands'] as List?) ?? [];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _q,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onChanged: _changed,
          onSubmitted: _go,
          decoration: const InputDecoration(hintText: 'Search products, brands…', prefixIcon: Icon(Icons.search)),
        ),
        actions: const [SizedBox(width: 12)],
      ),
      body: ListView(children: [
        if (_didYouMean != null)
          ListTile(
            leading: const Icon(Icons.auto_fix_high, color: Brand.violet),
            title: Text.rich(TextSpan(text: 'Did you mean ', children: [
              TextSpan(text: _didYouMean, style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.violet)),
              const TextSpan(text: '?'),
            ])),
            onTap: () {
              _q.text = _didYouMean!;
              _go(_didYouMean!);
            },
          ),
        if (s != null && products.isEmpty && cats.isEmpty && brands.isEmpty && _didYouMean == null)
          const Padding(padding: EdgeInsets.all(40), child: Center(child: Text('No matches', style: TextStyle(color: Brand.muted)))),
        if (products.isNotEmpty) _head('PRODUCTS'),
        for (final p in products)
          ListTile(
            leading: SizedBox(width: 44, height: 44, child: Photo(p['imageUrl'] as String?, radius: 10, padding: 4)),
            title: Text(p['name'], maxLines: 1, overflow: TextOverflow.ellipsis),
            trailing: Text(money(p['price'] as num, p['currency']), style: const TextStyle(fontWeight: FontWeight.w700)),
            onTap: () => context.push('/product/${p['slug']}'),
          ),
        if (cats.isNotEmpty) _head('CATEGORIES'),
        for (final c in cats)
          ListTile(
            leading: const Icon(Icons.grid_view_rounded, color: Brand.violet),
            title: Text(c['name']),
            onTap: () => context.push('/products?category=${c['slug']}&title=${Uri.encodeQueryComponent(c['name'])}'),
          ),
        if (brands.isNotEmpty) _head('BRANDS'),
        for (final b in brands)
          ListTile(
            leading: const Icon(Icons.sell_outlined, color: Brand.violet),
            title: Text(b['name']),
            onTap: () => _go(b['name']),
          ),
        if (_q.text.trim().length >= 2)
          ListTile(
            leading: const Icon(Icons.search, color: Brand.muted),
            title: Text('See all results for "${_q.text.trim()}"', style: const TextStyle(fontWeight: FontWeight.w700)),
            onTap: () => _go(_q.text),
          ),
      ]),
    );
  }
}
