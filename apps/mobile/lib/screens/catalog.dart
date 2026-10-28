import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';

String _to(String slug, String name) => '/products?category=$slug&title=${Uri.encodeComponent(name)}';

/// All categories: each root expands to its sub-categories.
class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cats = ref.watch(categoriesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Categories')),
      body: cats.when(
        loading: loading,
        error: (e, _) => failed(e, () => ref.invalidate(categoriesProvider)),
        data: (list) => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final c = list[i];
            return Container(
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r22)),
              clipBehavior: Clip.antiAlias,
              child: ExpansionTile(
                shape: const Border(),
                leading: CircleAvatar(
                  backgroundColor: Brand.tints[i % Brand.tints.length],
                  child: Text(c.name[0], style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.violet)),
                ),
                title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('${c.children.length} sub-categories', style: const TextStyle(color: Brand.muted, fontSize: 12)),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                children: [
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    ActionChip(
                      label: Text('All ${c.name}'),
                      backgroundColor: Brand.violetSoft,
                      side: BorderSide.none,
                      onPressed: () => context.push(_to(c.slug, c.name)),
                    ),
                    for (final s in c.children)
                      ActionChip(
                        label: Text(s.name),
                        backgroundColor: Brand.canvas,
                        side: BorderSide.none,
                        onPressed: () => context.push(_to(s.slug, s.name)),
                      ),
                  ]),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Product grid with search, quick filters and sort (same query params as the web API).
class ProductListScreen extends ConsumerStatefulWidget {
  const ProductListScreen({super.key, required this.title, required this.query});
  final String title;
  final Map<String, String> query;
  @override
  ConsumerState<ProductListScreen> createState() => _ProductListState();
}

class _ProductListState extends ConsumerState<ProductListScreen> {
  late Map<String, String> q = {...widget.query, 'limit': '40'};
  final _search = TextEditingController();

  void _set(String key, String? value) => setState(() {
        q = {...q};
        if (value == null) {
          q.remove(key);
        } else {
          q[key] = value;
        }
      });

  @override
  Widget build(BuildContext context) {
    final items = ref.watch(productsProvider(q));
    final chips = <(String, String, String)>[
      ('On sale', 'onSale', 'true'),
      ('In stock', 'inStock', 'true'),
      ('4★ & up', 'minRating', '4'),
    ];
    const sorts = {'newest': 'Newest', 'popular': 'Popular', 'price_asc': 'Price ↑', 'price_desc': 'Price ↓', 'rating': 'Top rated'};
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(children: [
        Container(
          color: Brand.violet,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            autofocus: widget.title == 'Search',
            decoration: const InputDecoration(hintText: 'Search products', prefixIcon: Icon(Icons.search)),
            onSubmitted: (v) => _set('q', v.trim().isEmpty ? null : v.trim()),
          ),
        ),
        SizedBox(
          height: 52,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
            children: [
              for (final (label, key, value) in chips)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(label),
                    selected: q[key] == value,
                    selectedColor: Brand.violet,
                    checkmarkColor: Colors.white,
                    labelStyle: TextStyle(color: q[key] == value ? Colors.white : Brand.ink, fontWeight: FontWeight.w600),
                    backgroundColor: Colors.white,
                    side: BorderSide.none,
                    shape: const StadiumBorder(),
                    onSelected: (on) => _set(key, on ? value : null),
                  ),
                ),
              PopupMenuButton<String>(
                initialValue: q['sort'],
                onSelected: (v) => _set('sort', v),
                itemBuilder: (_) => [for (final e in sorts.entries) PopupMenuItem(value: e.key, child: Text(e.value))],
                child: Chip(
                  avatar: const Icon(Icons.swap_vert, size: 18),
                  label: Text(sorts[q['sort']] ?? 'Sort'),
                  backgroundColor: Colors.white,
                  side: BorderSide.none,
                  shape: const StadiumBorder(),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: items.when(
            loading: loading,
            error: (e, _) => failed(e, () => ref.invalidate(productsProvider(q))),
            data: (list) => list.isEmpty
                ? const Center(child: Text('No products found', style: TextStyle(color: Brand.muted)))
                : GridView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.58),
                    itemCount: list.length,
                    itemBuilder: (_, i) => ProductTile(list[i]),
                  ),
          ),
        ),
      ]),
    );
  }
}
