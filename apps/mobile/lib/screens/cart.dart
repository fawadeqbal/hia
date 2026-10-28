import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final notifier = ref.read(cartProvider.notifier);
    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: cart.when(
        loading: loading,
        error: (e, _) => failed(e, () => ref.invalidate(cartProvider)),
        data: (c) {
          final groups = (c['groups'] as List?) ?? [];
          final currency = (c['currency'] ?? 'USD') as String;
          if ((c['itemCount'] ?? 0) == 0) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 76, height: 76,
                  decoration: BoxDecoration(color: Brand.violetSoft, borderRadius: BorderRadius.circular(Brand.r22)),
                  child: const Icon(Icons.shopping_cart_outlined, size: 34, color: Brand.violet),
                ),
                const SizedBox(height: 14),
                const Text('Your cart is empty', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                const Text('Find something you love and add it here.', style: TextStyle(color: Brand.muted)),
                const SizedBox(height: 16),
                SizedBox(width: 200, child: FilledButton(onPressed: () => context.go('/'), child: const Text('Start shopping'))),
              ]),
            );
          }
          return Column(children: [
            Expanded(
              child: ListView(padding: const EdgeInsets.all(16), children: [
                for (final g in groups)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r22)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                        child: Text.rich(TextSpan(text: 'Sold by ', style: const TextStyle(color: Brand.muted), children: [
                          TextSpan(text: g['vendor']['name'], style: const TextStyle(color: Brand.ink, fontWeight: FontWeight.w700)),
                        ])),
                      ),
                      for (final it in (g['items'] as List))
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            SizedBox(width: 80, height: 80, child: Photo(it['imageUrl'], padding: 6)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(it['productName'], maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                                if (it['variantName'] != null)
                                  Text(it['variantName'], style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
                                const SizedBox(height: 6),
                                Row(children: [
                                  Text(money((it['unitPrice'] as num) * (it['quantity'] as num), currency),
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                                  const Spacer(),
                                  _Qty(
                                    qty: it['quantity'] as int,
                                    max: it['available'] as int,
                                    onChange: (q) => q == 0 ? notifier.remove(it['id']) : notifier.setQty(it['id'], q),
                                  ),
                                ]),
                              ]),
                            ),
                          ]),
                        ),
                    ]),
                  ),
              ]),
            ),
            SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Brand.line))),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Row(children: [
                    const Text('Total so far', style: TextStyle(fontWeight: FontWeight.w700)),
                    const Spacer(),
                    Text(money(c['subtotal'] as num, currency), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                  ]),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: c['canCheckout'] == true ? () => context.push('/checkout') : null,
                    child: const Text('Checkout'),
                  ),
                  const SizedBox(height: 6),
                  const Text('Shipping, tax and points are added at checkout.', style: TextStyle(color: Brand.muted, fontSize: 12)),
                ]),
              ),
            ),
          ]);
        },
      ),
    );
  }
}

class _Qty extends StatelessWidget {
  const _Qty({required this.qty, required this.max, required this.onChange});
  final int qty;
  final int max;
  final void Function(int) onChange;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(30)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(visualDensity: VisualDensity.compact, onPressed: () => onChange(qty - 1),
              icon: Icon(qty == 1 ? Icons.delete_outline : Icons.remove, size: 18)),
          Text('$qty', style: const TextStyle(fontWeight: FontWeight.w800)),
          IconButton(visualDensity: VisualDensity.compact, onPressed: qty < max ? () => onChange(qty + 1) : null,
              icon: const Icon(Icons.add, size: 18)),
        ]),
      );
}

