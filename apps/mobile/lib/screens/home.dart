import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesProvider);
          ref.invalidate(productsProvider);
        },
        child: CustomScrollView(slivers: [
          const _Header(),
          const SliverToBoxAdapter(child: _Hero()),
          const SliverToBoxAdapter(child: _Perks()),
          SliverToBoxAdapter(
            child: SectionHead('Shop by category', eyebrow: 'Explore', onAll: () => context.go('/categories')),
          ),
          const SliverToBoxAdapter(child: _Categories()),
          const SliverToBoxAdapter(child: _Row('Today’s deals', 'Limited time', {'onSale': 'true', 'inStock': 'true', 'limit': '10'})),
          const SliverToBoxAdapter(child: _Row('Best sellers', 'Trending now', {'sort': 'popular', 'limit': '10'})),
          const SliverToBoxAdapter(child: _Row('New arrivals', 'Just landed', {'sort': 'newest', 'limit': '10'})),
          const SliverToBoxAdapter(child: SizedBox(height: 28)),
        ]),
      ),
    );
  }
}

/// Solid violet bar: logo + cart, search pill pinned underneath.
class _Header extends ConsumerWidget {
  const _Header();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SliverAppBar(
      pinned: true,
      backgroundColor: Brand.violet,
      surfaceTintColor: Colors.transparent,
      toolbarHeight: 56,
      titleSpacing: 16,
      title: const Text.rich(
        TextSpan(text: 'E-cart', children: [TextSpan(text: '.', style: TextStyle(color: Brand.yellow))]),
        style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.5),
      ),
      actions: [
        IconButton(
          tooltip: 'Wishlist',
          onPressed: () => ref.read(apiProvider).signedIn ? context.push('/account/wishlist') : context.push('/login'),
          icon: const Icon(Icons.favorite_border_rounded, color: Colors.white),
        ),
        const SizedBox(width: 6),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 2, 16, 12),
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(Brand.r14),
            child: InkWell(
              borderRadius: BorderRadius.circular(Brand.r14),
              onTap: () => context.push('/search'),
              child: const SizedBox(
                height: 46,
                child: Row(children: [
                  SizedBox(width: 14),
                  Icon(Icons.search_rounded, color: Brand.muted, size: 22),
                  SizedBox(width: 10),
                  Expanded(child: Text('Search products, brands…', style: TextStyle(color: Brand.muted, fontSize: 14.5))),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        child: Material(
          color: Brand.violetSoft,
          borderRadius: BorderRadius.circular(Brand.r22),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => context.push('/products?onSale=true&title=Deals'),
            child: Stack(children: [
              Positioned(
                right: -18,
                bottom: -22,
                child: Icon(Icons.local_offer_rounded, size: 130, color: Brand.violet.withOpacity(.08)),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: Brand.yellow, borderRadius: BorderRadius.circular(99)),
                    child: const Text('THIS WEEK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: .6)),
                  ),
                  const SizedBox(height: 10),
                  const Text('Top brands, up to 25% off',
                      style: TextStyle(fontSize: 21, height: 1.15, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                  const SizedBox(height: 4),
                  const Text('Fresh deals from trusted sellers', style: TextStyle(color: Brand.muted, fontSize: 13.5)),
                  const SizedBox(height: 12),
                  const Row(mainAxisSize: MainAxisSize.min, children: [
                    Text('Shop deals', style: TextStyle(color: Brand.violet, fontWeight: FontWeight.w800)),
                    SizedBox(width: 2),
                    Icon(Icons.arrow_forward_rounded, size: 18, color: Brand.violet),
                  ]),
                ]),
              ),
            ]),
          ),
        ),
      );
}

/// Three quiet trust points.
class _Perks extends StatelessWidget {
  const _Perks();
  @override
  Widget build(BuildContext context) {
    Widget perk(IconData i, String t) => Expanded(
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(i, size: 17, color: Brand.violet),
            const SizedBox(width: 5),
            Flexible(child: Text(t, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
          ]),
        );
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r16)),
      child: Row(children: [
        perk(Icons.payments_outlined, 'Cash on delivery'),
        perk(Icons.replay_rounded, 'Easy returns'),
        perk(Icons.verified_user_outlined, 'Secure pay'),
      ]),
    );
  }
}

/// Top-level categories as a tidy 4-column grid of square tint tiles.
class _Categories extends ConsumerWidget {
  const _Categories();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cats = ref.watch(categoriesProvider);
    Widget grid(int n, Widget Function(int) cell) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            itemCount: n,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              mainAxisSpacing: 14,
              crossAxisSpacing: 12,
              childAspectRatio: .78,
            ),
            itemBuilder: (_, i) => cell(i),
          ),
        );
    return cats.when(
      loading: () => grid(8, (_) => const Column(children: [
            AspectRatio(aspectRatio: 1, child: Skeleton()),
            SizedBox(height: 8),
            Skeleton(height: 10, width: 48, radius: 4),
          ])),
      error: (e, _) => _Retry(() => ref.invalidate(categoriesProvider)),
      data: (list) {
        final top = list.take(8).toList();
        return grid(top.length, (i) {
          final c = top[i];
          return GestureDetector(
            onTap: () => context.push('/products?category=${c.slug}&title=${Uri.encodeComponent(c.name)}'),
            child: Column(children: [
              AspectRatio(
                aspectRatio: 1,
                child: Container(
                  decoration: BoxDecoration(color: Brand.tints[i % Brand.tints.length], borderRadius: BorderRadius.circular(Brand.r16)),
                  clipBehavior: Clip.antiAlias,
                  padding: const EdgeInsets.all(8),
                  child: c.imageUrl != null
                      ? CachedNetworkImage(imageUrl: c.imageUrl!, fit: BoxFit.contain)
                      : Center(
                          child: Text(c.name[0],
                              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Brand.violet)),
                        ),
                ),
              ),
              const SizedBox(height: 6),
              Text(c.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            ]),
          );
        });
      },
    );
  }
}

class _Retry extends StatelessWidget {
  const _Retry(this.onTap);
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r16)),
        child: Row(children: [
          const Icon(Icons.wifi_off_rounded, size: 18, color: Brand.muted),
          const SizedBox(width: 10),
          const Expanded(child: Text('Couldn’t load. Check your connection.', style: TextStyle(color: Brand.muted, fontSize: 13))),
          TextButton(onPressed: onTap, child: const Text('Retry')),
        ]),
      );
}

/// A titled horizontal row of product tiles.
class _Row extends ConsumerWidget {
  const _Row(this.title, this.eyebrow, this.query);
  final String title;
  final String eyebrow;
  final Map<String, String> query;

  static const _w = 156.0, _h = 284.0;

  Widget _strip(int n, Widget Function(int) item) => SizedBox(
        height: _h,
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          scrollDirection: Axis.horizontal,
          itemCount: n,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (_, i) => item(i),
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(productsProvider(query));
    final params = Uri(queryParameters: {...query, 'title': title}..remove('limit')).query;
    final head = SectionHead(title, eyebrow: eyebrow, onAll: () => context.push('/products?$params'));
    return items.when(
      loading: () => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        head,
        _strip(3, (_) => const Skeleton(width: _w, radius: Brand.r22)),
      ]),
      error: (_, __) => const SizedBox.shrink(),
      data: (list) => list.isEmpty
          ? const SizedBox.shrink()
          : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              head,
              _strip(list.length, (i) => ProductTile(list[i], width: _w)),
            ]),
    );
  }
}
