import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'models.dart';
import 'theme.dart';

String money(num v, String currency) => NumberFormat.simpleCurrency(name: currency).format(v);

/// Product photo on the light grey "photo" tile (photos with white backgrounds blend in).
class Photo extends StatelessWidget {
  const Photo(this.url, {super.key, this.radius = Brand.r16, this.padding = 10});
  final String? url;
  final double radius;
  final double padding;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Container(
          color: Brand.photo,
          padding: EdgeInsets.all(padding),
          child: url == null
              ? const Center(child: Icon(Icons.image_outlined, color: Brand.muted))
              : CachedNetworkImage(imageUrl: url!, fit: BoxFit.contain, fadeInDuration: const Duration(milliseconds: 250)),
        ),
      );
}

class SectionHead extends StatelessWidget {
  const SectionHead(this.title, {super.key, this.eyebrow, this.onAll});
  final String title;
  final String? eyebrow;
  final VoidCallback? onAll;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 26, 8, 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (eyebrow != null)
                Text(eyebrow!.toUpperCase(),
                    style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 1.3, color: Brand.violet)),
              const SizedBox(height: 2),
              Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
            ]),
          ),
          if (onAll != null)
            TextButton(
              onPressed: onAll,
              style: TextButton.styleFrom(foregroundColor: Brand.violet, visualDensity: VisualDensity.compact),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Text('See all', style: TextStyle(fontWeight: FontWeight.w700)),
                Icon(Icons.chevron_right_rounded, size: 20),
              ]),
            ),
        ]),
      );
}

/// Soft grey block used as a loading placeholder (no spinners on home).
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.width, this.height, this.radius = Brand.r16});
  final double? width, height;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(color: const Color(0xFFECEAF3), borderRadius: BorderRadius.circular(radius)),
      );
}

class ProductTile extends StatelessWidget {
  const ProductTile(this.p, {super.key, this.width});
  final ProductCard p;
  final double? width;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: width,
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(Brand.r22),
          child: InkWell(
            borderRadius: BorderRadius.circular(Brand.r22),
            onTap: () => context.push('/product/${p.slug}'),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                AspectRatio(
                  aspectRatio: 1,
                  child: Stack(children: [
                    Positioned.fill(child: Opacity(opacity: p.inStock ? 1 : 0.5, child: Photo(p.imageUrl))),
                    if (p.discount > 0)
                      Positioned(left: 8, top: 8, child: _Badge('−${p.discount}%', Brand.yellow, Brand.ink)),
                    if (!p.inStock) const Positioned(left: 8, bottom: 8, child: _Badge('Out of stock', Colors.white, Brand.muted)),
                  ]),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: Text((p.brand ?? '').toUpperCase(),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 10.5, letterSpacing: .6, color: Brand.muted, fontWeight: FontWeight.w600)),
                  ),
                  if (p.ratingCount > 0) ...[
                    const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFBBF24)),
                    Text(p.rating.toStringAsFixed(1), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600)),
                  ],
                ]),
                const SizedBox(height: 2),
                Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, height: 1.25)),
                const SizedBox(height: 6),
                Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 6, children: [
                  Text(money(p.price, p.currency), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  if (p.compareAt != null && p.discount > 0)
                    Text(money(p.compareAt!, p.currency),
                        style: const TextStyle(fontSize: 11.5, color: Brand.muted, decoration: TextDecoration.lineThrough)),
                ]),
              ]),
            ),
          ),
        ),
      );
}

class _Badge extends StatelessWidget {
  const _Badge(this.text, this.bg, this.fg);
  final String text;
  final Color bg;
  final Color fg;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: fg)),
      );
}

/// Loading / error wrapper for AsyncValue lists.
Widget loading() => const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()));
Widget failed(Object e, VoidCallback retry) => Padding(
      padding: const EdgeInsets.all(24),
      child: Column(children: [
        Text('$e', textAlign: TextAlign.center, style: const TextStyle(color: Brand.muted)),
        TextButton(onPressed: retry, child: const Text('Try again')),
      ]),
    );
