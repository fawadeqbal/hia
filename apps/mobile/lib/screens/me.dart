import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../checkout_api.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';

// ── Data (NestJS: /orders, /wishlist, /loyalty, /users/me/addresses) ──
Map<String, dynamic> _m(Object? v) => Map<String, dynamic>.from(v as Map);

final myOrdersProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = _m(await ref.read(apiProvider).get('/orders', query: {'page': 1, 'limit': 50}));
  return (res['items'] as List).map(_m).toList();
});
final wishlistProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = _m(await ref.read(apiProvider).get('/wishlist'));
  return (res['items'] as List).map(_m).toList();
});
final loyaltyProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
    (ref) async => _m(await ref.read(apiProvider).get('/loyalty')));

String _date(String iso) => DateFormat('d MMM y').format(DateTime.parse(iso).toLocal());
String _title(String s) => s.isEmpty ? s : s[0] + s.substring(1).toLowerCase().replaceAll('_', ' ');

Widget _empty(IconData icon, String text) => Padding(
      padding: const EdgeInsets.all(48),
      child: Column(children: [
        Icon(icon, size: 44, color: Brand.muted),
        const SizedBox(height: 10),
        Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Brand.muted)),
      ]),
    );

BoxDecoration get _card => BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r16));

Widget _list<T>(WidgetRef ref, AsyncValue<List<T>> v, ProviderOrFamily p, Widget empty, Widget Function(T) item) =>
    v.when(
      loading: loading,
      error: (e, _) => failed(e, () => ref.invalidate(p)),
      data: (list) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(p),
        child: list.isEmpty
            ? ListView(children: [empty])
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) => item(list[i]),
              ),
      ),
    );

// ── Orders ──
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        appBar: AppBar(title: const Text('My orders')),
        body: _list<Map<String, dynamic>>(ref, ref.watch(myOrdersProvider), myOrdersProvider,
            _empty(Icons.inventory_2_outlined, 'No orders yet'), (o) {
          final status = o['status'] as String;
          final unpaid = o['paymentStatus'] == 'PENDING' && o['paymentMethod'] != 'COD' && status != 'CANCELLED';
          final color = status == 'CANCELLED'
              ? Colors.red
              : unpaid
                  ? const Color(0xFFB7791F)
                  : status == 'DELIVERED'
                      ? Colors.green
                      : Brand.violet;
          return InkWell(
            borderRadius: BorderRadius.circular(Brand.r16),
            onTap: () async {
              await context.push('/order/${o['orderNumber']}');
              ref.invalidate(myOrdersProvider);
            },
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: _card,
              child: Row(children: [
                SizedBox(width: 64, height: 64, child: Photo(o['imageUrl'] as String?, radius: 12, padding: 6)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('#${o['orderNumber']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text('${_date(o['placedAt'])} · ${o['itemCount']} item${o['itemCount'] == 1 ? '' : 's'}',
                        style: const TextStyle(fontSize: 12, color: Brand.muted)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: color.withOpacity(.1), borderRadius: BorderRadius.circular(99)),
                      child: Text(unpaid ? 'Awaiting payment' : _title(status),
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
                    ),
                  ]),
                ),
                Text(money(o['grandTotal'] as num, o['currency']), style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
            ),
          );
        }),
      );
}

// ── Wishlist ──
class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(apiProvider);
    Future<void> run(Future<void> Function() f, [String? ok]) async {
      try {
        await f();
        if (ok != null && context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
      } catch (e) {
        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
      ref.invalidate(wishlistProvider);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist')),
      body: _list<Map<String, dynamic>>(ref, ref.watch(wishlistProvider), wishlistProvider,
          _empty(Icons.favorite_border, 'Tap the heart on a product to save it here'), (w) {
        final canBuy = w['inStock'] == true && w['unavailable'] != true;
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: _card,
          child: Row(children: [
            GestureDetector(
              onTap: () => context.push('/product/${w['slug']}'),
              child: SizedBox(width: 72, height: 72, child: Photo(w['imageUrl'] as String?, radius: 12, padding: 6)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(w['name'], maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(w['vendorName'], style: const TextStyle(fontSize: 12, color: Brand.muted)),
                const SizedBox(height: 4),
                Row(children: [
                  Text(money(w['price'] as num, w['currency']), style: const TextStyle(fontWeight: FontWeight.w800)),
                  if (w['priceDropped'] == true) ...[
                    const SizedBox(width: 6),
                    const Text('Price dropped', style: TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w700)),
                  ],
                ]),
                if (!canBuy)
                  Text(w['unavailable'] == true ? 'No longer available' : 'Out of stock',
                      style: const TextStyle(fontSize: 12, color: Colors.red)),
              ]),
            ),
            Column(children: [
              IconButton(
                tooltip: 'Remove',
                icon: const Icon(Icons.close, size: 20, color: Brand.muted),
                onPressed: () => run(() => api.delete('/wishlist/items/${w['id']}')),
              ),
              IconButton.filledTonal(
                tooltip: 'Move to cart',
                icon: const Icon(Icons.shopping_bag_outlined, size: 20),
                onPressed: canBuy
                    ? () => run(() async {
                          await api.post('/wishlist/items/${w['id']}/move-to-cart');
                          ref.invalidate(cartProvider);
                        }, 'Moved to cart')
                    : null,
              ),
            ]),
          ]),
        );
      }),
    );
  }
}

// ── Points ──
class PointsScreen extends ConsumerWidget {
  const PointsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        appBar: AppBar(title: const Text('Points & rewards')),
        body: ref.watch(loyaltyProvider).when(
              loading: loading,
              error: (e, _) => failed(e, () => ref.invalidate(loyaltyProvider)),
              data: (l) {
                final tier = l['tier'] as Map?;
                final next = l['nextTier'] as Map?;
                final history = (l['history'] as List).map(_m).toList();
                return ListView(padding: const EdgeInsets.all(16), children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(Brand.r22),
                      gradient: const LinearGradient(colors: [Color(0xFF6447E6), Color(0xFF3B2390)]),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tier?['name'] ?? 'Member', style: const TextStyle(color: Brand.yellow, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      Text(NumberFormat.decimalPattern().format(l['points']),
                          style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800)),
                      Text('points · worth ${money(l['value'] as num, l['currency'])}',
                          style: const TextStyle(color: Colors.white70)),
                      if (next != null) ...[
                        const SizedBox(height: 10),
                        Text('${next['pointsNeeded']} more to reach ${next['name']}',
                            style: const TextStyle(color: Colors.white, fontSize: 12)),
                      ],
                    ]),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    decoration: _card,
                    child: ListTile(
                      leading: const Icon(Icons.card_giftcard, color: Brand.violet),
                      title: const Text('Your referral code', style: TextStyle(fontSize: 12, color: Brand.muted)),
                      subtitle: SelectableText(l['referralCode'],
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Brand.ink)),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text('History', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 8),
                  if (history.isEmpty) _empty(Icons.star_border_rounded, 'Earn points on every order'),
                  for (final h in history)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: _card,
                      child: ListTile(
                        dense: true,
                        title: Text(h['description'] ?? _title(h['type']), style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(_date(h['createdAt'])),
                        trailing: Text('${(h['points'] as num) > 0 ? '+' : ''}${h['points']}',
                            style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: (h['points'] as num) > 0 ? Colors.green : Colors.red)),
                      ),
                    ),
                ]);
              },
            ),
      );
}

// ── Addresses ──
class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(apiProvider);
    Future<void> run(Future<void> Function() f) async {
      try {
        await f();
      } catch (e) {
        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
      ref.invalidate(addressesProvider);
    }

    Future<void> edit([Map<String, dynamic>? a]) async {
      final body = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.white,
        builder: (_) => _AddressForm(a),
      );
      if (body != null) {
        await run(() => a == null ? api.post('/users/me/addresses', body) : api.patch('/users/me/addresses/${a['id']}', body));
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Addresses')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: edit,
        icon: const Icon(Icons.add),
        label: const Text('Add address'),
      ),
      body: _list<Map<String, dynamic>>(ref, ref.watch(addressesProvider), addressesProvider,
          _empty(Icons.place_outlined, 'No saved addresses'), (a) {
        return Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
          decoration: _card,
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text(a['label'] ?? a['fullName'], style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (a['isDefault'] == true) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(color: Brand.violetSoft, borderRadius: BorderRadius.circular(99)),
                      child: const Text('Default', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Brand.violet)),
                    ),
                  ],
                ]),
                const SizedBox(height: 4),
                Text(
                  [a['fullName'], a['phone'], a['line1'], a['line2'], a['city'], a['state'], a['postalCode'], a['countryCode']]
                      .where((s) => s != null && '$s'.isNotEmpty)
                      .join(', '),
                  style: const TextStyle(fontSize: 13, color: Brand.muted),
                ),
              ]),
            ),
            PopupMenuButton<String>(
              onSelected: (v) => switch (v) {
                'edit' => edit(a),
                'default' => run(() => api.patch('/users/me/addresses/${a['id']}', {'isDefault': true})),
                _ => run(() => api.delete('/users/me/addresses/${a['id']}')),
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                if (a['isDefault'] != true) const PopupMenuItem(value: 'default', child: Text('Make default')),
                const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: Colors.red))),
              ],
            ),
          ]),
        );
      }),
    );
  }
}

class _AddressForm extends StatefulWidget {
  const _AddressForm(this.a);
  final Map<String, dynamic>? a;
  @override
  State<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<_AddressForm> {
  static const _fields = {
    'label': 'Label (Home, Office…)',
    'fullName': 'Full name *',
    'phone': 'Phone *',
    'line1': 'Address line *',
    'line2': 'Apartment, area',
    'city': 'City *',
    'state': 'State / province',
    'postalCode': 'Postal code',
    'countryCode': 'Country code *',
  };
  late final c = {
    for (final k in _fields.keys)
      k: TextEditingController(text: widget.a?[k]?.toString() ?? (k == 'countryCode' ? 'PK' : '')),
  };
  late bool isDefault = widget.a?['isDefault'] == true;
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    for (final x in c.values) {
      x.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
        child: Form(
          key: _form,
          child: ListView(shrinkWrap: true, children: [
            Text(widget.a == null ? 'New address' : 'Edit address',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            for (final e in _fields.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: TextFormField(
                  controller: c[e.key],
                  decoration: InputDecoration(labelText: e.value),
                  textCapitalization: e.key == 'countryCode' ? TextCapitalization.characters : TextCapitalization.words,
                  keyboardType: e.key == 'phone' ? TextInputType.phone : null,
                  validator: (v) => e.value.endsWith('*') && (v ?? '').trim().isEmpty ? 'Required' : null,
                ),
              ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Use as default'),
              value: isDefault,
              onChanged: (v) => setState(() => isDefault = v),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () {
                if (!_form.currentState!.validate()) return;
                Navigator.pop(context, {
                  for (final e in c.entries)
                    e.key: e.value.text.trim().isEmpty
                        ? null
                        : e.key == 'countryCode'
                            ? e.value.text.trim().toUpperCase()
                            : e.value.text.trim(),
                  'isDefault': isDefault,
                });
              },
              child: const Text('Save address'),
            ),
          ]),
        ),
      );
}
