import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';
import 'product_extras.dart';

class ProductScreen extends ConsumerStatefulWidget {
  const ProductScreen({super.key, required this.slug});
  final String slug;
  @override
  ConsumerState<ProductScreen> createState() => _ProductState();
}

class _ProductState extends ConsumerState<ProductScreen> {
  Map<String, String>? selected; // attributeId -> valueId
  int photo = 0;
  int qty = 1;
  bool adding = false;

  Variant? _variant(ProductDetail p) {
    if (p.options.isEmpty) return p.variants.firstWhere((v) => v.id == p.defaultVariantId, orElse: () => p.variants.first);
    final sel = selected!;
    for (final v in p.variants) {
      if (p.options.every((o) => v.values[o['attributeId']] == sel[o['attributeId']])) return v;
    }
    return null;
  }

  Future<void> _add(Variant v, {bool buyNow = false}) async {
    setState(() => adding = true);
    try {
      await ref.read(cartProvider.notifier).add(v.id, qty);
      if (!mounted) return;
      if (buyNow) {
        context.go('/cart');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          behavior: SnackBarBehavior.floating,
          content: const Text('Added to cart'),
          action: SnackBarAction(label: 'View cart', onPressed: () => context.go('/cart')),
        ));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = ref.watch(productProvider(widget.slug));
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(backgroundColor: Colors.white, foregroundColor: Brand.ink),
      body: product.when(
        loading: loading,
        error: (e, _) => failed(e, () => ref.invalidate(productProvider(widget.slug))),
        data: (p) {
          selected ??= {...p.variants.firstWhere((v) => v.id == p.defaultVariantId, orElse: () => p.variants.first).values};
          final v = _variant(p);
          final images = p.images.isEmpty ? <String?>[null] : p.images;
          return Column(children: [
            Expanded(
              child: ListView(padding: EdgeInsets.zero, children: [
                // Gallery: swipe + dots
                AspectRatio(
                  aspectRatio: 1,
                  child: Stack(children: [
                    PageView.builder(
                      itemCount: images.length,
                      onPageChanged: (i) => setState(() => photo = i),
                      itemBuilder: (_, i) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Photo(images[i], radius: Brand.r28, padding: 24),
                      ),
                    ),
                    if (images.length > 1)
                      Positioned(
                        bottom: 14,
                        left: 0,
                        right: 0,
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          for (var i = 0; i < images.length; i++)
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              width: i == photo ? 20 : 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: i == photo ? Brand.violet : Brand.line,
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                        ]),
                      ),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (p.brand != null)
                      Text(p.brand!.toUpperCase(),
                          style: const TextStyle(fontSize: 12, letterSpacing: 1, color: Brand.muted, fontWeight: FontWeight.w600)),
                    Text(p.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, height: 1.15)),
                    const SizedBox(height: 6),
                    Row(children: [
                      if (p.ratingCount > 0) ...[
                        const Icon(Icons.star_rounded, size: 18, color: Color(0xFFFBBF24)),
                        Text(' ${p.rating.toStringAsFixed(1)} (${p.ratingCount})  ·  ', style: const TextStyle(fontWeight: FontWeight.w600)),
                      ],
                      Text('Sold by ${p.vendor}', style: const TextStyle(color: Brand.muted)),
                    ]),
                    const SizedBox(height: 14),
                    if (v != null)
                      Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 8, children: [
                        Text(money(v.price, p.currency), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Brand.violet)),
                        if (v.compareAt != null && v.compareAt! > v.price)
                          Text(money(v.compareAt!, p.currency),
                              style: const TextStyle(color: Brand.muted, decoration: TextDecoration.lineThrough)),
                      ]),
                    // Options: Color / Size / Storage…
                    for (final o in p.options) ...[
                      const SizedBox(height: 16),
                      Text(o['name'], style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        for (final val in (o['values'] as List))
                          ChoiceChip(
                            label: Text(val['label']),
                            selected: selected![o['attributeId']] == val['id'],
                            selectedColor: Brand.violetSoft,
                            side: BorderSide(color: selected![o['attributeId']] == val['id'] ? Brand.violet : Brand.line),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            onSelected: (_) => setState(() => selected = {...selected!, o['attributeId']: val['id']}),
                          ),
                      ]),
                    ],
                    const SizedBox(height: 12),
                    Text(
                      v == null ? 'This combination is not available' : v.available > 0 ? (v.available <= 5 ? 'Only ${v.available} left' : 'In stock') : 'Out of stock',
                      style: TextStyle(fontWeight: FontWeight.w700, color: v != null && v.available > 0 ? const Color(0xFF047857) : Colors.red),
                    ),
                    if (p.description != null) ...[
                      const SizedBox(height: 18),
                      const Text('About this product', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      Text(p.description!, style: const TextStyle(color: Brand.muted, height: 1.45)),
                    ],
                    ProductExtras(productId: p.id),
                  ]),
                ),
              ]),
            ),
            // Sticky buy bar
            SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Brand.line))),
                child: Row(children: [
                  Container(
                    decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(30)),
                    child: Row(children: [
                      IconButton(onPressed: qty > 1 ? () => setState(() => qty--) : null, icon: const Icon(Icons.remove)),
                      Text('$qty', style: const TextStyle(fontWeight: FontWeight.w800)),
                      IconButton(
                          onPressed: v != null && qty < v.available ? () => setState(() => qty++) : null, icon: const Icon(Icons.add)),
                    ]),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: v == null || v.available <= 0 || adding ? null : () => _add(v),
                      child: Text(adding ? 'Adding…' : 'Add to cart'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: Brand.yellow, foregroundColor: Brand.ink, minimumSize: const Size(96, 52)),
                    onPressed: v == null || v.available <= 0 || adding ? null : () => _add(v, buyNow: true),
                    child: const Text('Buy'),
                  ),
                ]),
              ),
            ),
          ]);
        },
      ),
    );
  }
}
