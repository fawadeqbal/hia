import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';

// NestJS: POST /orders/:n/cancel · POST /returns · POST /reviews · PATCH /users/me · POST /users/me/password

const _returnReasons = {
  'DAMAGED': 'Arrived damaged',
  'WRONG_ITEM': 'Wrong item sent',
  'NOT_AS_DESCRIBED': 'Not as described',
  'MISSING_PARTS': 'Missing parts or accessories',
  'NO_LONGER_NEEDED': 'No longer needed',
  'OTHER': 'Other',
};

void _toast(BuildContext context, String text) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

Future<T?> _sheet<T>(BuildContext context, Widget child) => showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      builder: (c) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(c).viewInsets.bottom + 16),
        child: child,
      ),
    );

/// Cancel / track / return / review — shown under the items on the order screen (signed-in only).
class OrderActions extends ConsumerWidget {
  const OrderActions({super.key, required this.order, required this.onChanged});
  final Map<String, dynamic> order;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(apiProvider);
    if (!api.signedIn) return const SizedBox.shrink();
    final vos = (order['vendorOrders'] as List? ?? []).map((e) => Map<String, dynamic>.from(e)).toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final vo in vos) _VendorBlock(order: order, vo: vo, onChanged: onChanged),
      if (order['canCancel'] == true)
        TextButton(
          onPressed: () async {
            final reason = await _sheet<String>(context, const _CancelForm());
            if (reason == null || !context.mounted) return;
            try {
              await api.post('/orders/${Uri.encodeComponent(order['orderNumber'])}/cancel', {'reason': reason});
              if (context.mounted) _toast(context, 'Order cancelled');
              onChanged();
            } catch (e) {
              if (context.mounted) _toast(context, '$e');
            }
          },
          child: const Text('Cancel order', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w700)),
        ),
    ]);
  }
}

class _VendorBlock extends ConsumerWidget {
  const _VendorBlock({required this.order, required this.vo, required this.onChanged});
  final Map<String, dynamic> order, vo;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ship = vo['shipment'] as Map?;
    final delivered = vo['status'] == 'DELIVERED';
    final until = vo['returnableUntil'] == null ? null : DateTime.parse(vo['returnableUntil']).toLocal();
    final items = (vo['items'] as List).map((e) => Map<String, dynamic>.from(e)).toList();
    final canReturn = delivered &&
        until != null &&
        until.isAfter(DateTime.now()) &&
        items.any((i) => (i['returnableQuantity'] as num) > 0);
    if (ship == null && !delivered) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r22)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(vo['vendor']['name'], style: const TextStyle(fontWeight: FontWeight.w800)),
        if (ship != null) ...[
          const SizedBox(height: 6),
          Row(children: [
            const Icon(Icons.local_shipping_outlined, size: 18, color: Brand.violet),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                [ship['courierName'], ship['trackingNumber']].where((s) => s != null).join(' · ').ifEmpty('Shipped'),
                style: const TextStyle(fontSize: 13, color: Brand.muted),
              ),
            ),
            if (ship['trackingUrl'] != null)
              TextButton(
                onPressed: () => launchUrl(Uri.parse(ship['trackingUrl']), mode: LaunchMode.externalApplication),
                child: const Text('Track'),
              ),
          ]),
        ],
        if (delivered) ...[
          const SizedBox(height: 6),
          for (final it in items)
            Row(children: [
              Expanded(child: Text(it['productName'], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13))),
              TextButton.icon(
                icon: const Icon(Icons.star_border_rounded, size: 18, color: Color(0xFFB45309)),
                label: const Text('Review'),
                onPressed: () => _review(context, ref.read(apiProvider), it),
              ),
            ]),
          if (canReturn)
            OutlinedButton(
              onPressed: () async {
                final body = await _sheet<Map<String, dynamic>>(context, _ReturnForm(items: items));
                if (body == null || !context.mounted) return;
                try {
                  await ref.read(apiProvider).post('/returns', {
                    'orderNumber': order['orderNumber'],
                    'vendorOrderId': vo['id'],
                    ...body,
                  });
                  if (context.mounted) _toast(context, 'Return requested — the seller will review it');
                  onChanged();
                } catch (e) {
                  if (context.mounted) _toast(context, '$e');
                }
              },
              child: Text('Return items · until ${DateFormat('d MMM').format(until)}'),
            ),
        ],
      ]),
    );
  }

  Future<void> _review(BuildContext context, Api api, Map<String, dynamic> it) async {
    final body = await _sheet<Map<String, dynamic>>(context, _ReviewForm(name: it['productName']));
    if (body == null) return;
    try {
      final p = await api.get('/catalog/products/${it['productSlug']}') as Map;
      await api.post('/reviews', {'productId': p['id'], ...body});
      if (context.mounted) _toast(context, 'Thanks for your review!');
    } catch (e) {
      if (context.mounted) _toast(context, '$e');
    }
  }
}

extension on String {
  String ifEmpty(String v) => isEmpty ? v : this;
}

Widget _title(String t) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(t, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
    );

class _CancelForm extends StatefulWidget {
  const _CancelForm();
  @override
  State<_CancelForm> createState() => _CancelFormState();
}

class _CancelFormState extends State<_CancelForm> {
  static const reasons = ['Changed my mind', 'Ordered by mistake', 'Found a better price', 'Delivery takes too long', 'Other'];
  String reason = reasons.first;
  @override
  Widget build(BuildContext context) => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _title('Cancel this order?'),
        for (final r in reasons)
          RadioListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            value: r,
            groupValue: reason,
            title: Text(r),
            onChanged: (v) => setState(() => reason = v!),
          ),
        const SizedBox(height: 8),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Colors.red),
          onPressed: () => Navigator.pop(context, reason),
          child: const Text('Cancel order'),
        ),
      ]);
}

class _ReviewForm extends StatefulWidget {
  const _ReviewForm({required this.name});
  final String name;
  @override
  State<_ReviewForm> createState() => _ReviewFormState();
}

class _ReviewFormState extends State<_ReviewForm> {
  int rating = 5;
  final title = TextEditingController(), body = TextEditingController();
  @override
  void dispose() {
    title.dispose();
    body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _title('Rate ${widget.name}'),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 1; i <= 5; i++)
            IconButton(
              iconSize: 36,
              onPressed: () => setState(() => rating = i),
              icon: Icon(i <= rating ? Icons.star_rounded : Icons.star_border_rounded, color: Brand.yellow),
            ),
        ]),
        TextField(controller: title, decoration: const InputDecoration(labelText: 'Title (optional)')),
        const SizedBox(height: 10),
        TextField(controller: body, maxLines: 4, decoration: const InputDecoration(labelText: 'What did you like or dislike?')),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () => Navigator.pop(context, {
            'rating': rating,
            'title': title.text.trim().isEmpty ? null : title.text.trim(),
            'body': body.text.trim().isEmpty ? null : body.text.trim(),
          }),
          child: const Text('Submit review'),
        ),
      ]);
}

class _ReturnForm extends StatefulWidget {
  const _ReturnForm({required this.items});
  final List<Map<String, dynamic>> items;
  @override
  State<_ReturnForm> createState() => _ReturnFormState();
}

class _ReturnFormState extends State<_ReturnForm> {
  final qty = <String, int>{};
  String reason = 'DAMAGED';
  final comments = TextEditingController();
  @override
  void dispose() {
    comments.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lines = widget.items.where((i) => (i['returnableQuantity'] as num) > 0).toList();
    final picked = qty.entries.where((e) => e.value > 0).toList();
    return ListView(shrinkWrap: true, children: [
      _title('Return items'),
      for (final it in lines)
        Row(children: [
          SizedBox(width: 44, height: 44, child: Photo(it['imageUrl'] as String?, radius: 10, padding: 4)),
          const SizedBox(width: 10),
          Expanded(child: Text(it['productName'], maxLines: 2, overflow: TextOverflow.ellipsis)),
          IconButton(
            icon: const Icon(Icons.remove_circle_outline),
            onPressed: (qty[it['id']] ?? 0) > 0 ? () => setState(() => qty[it['id']] = qty[it['id']]! - 1) : null,
          ),
          Text('${qty[it['id']] ?? 0}', style: const TextStyle(fontWeight: FontWeight.w700)),
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            onPressed: (qty[it['id']] ?? 0) < (it['returnableQuantity'] as num)
                ? () => setState(() => qty[it['id']] = (qty[it['id']] ?? 0) + 1)
                : null,
          ),
        ]),
      const SizedBox(height: 10),
      DropdownButtonFormField<String>(
        value: reason,
        decoration: const InputDecoration(labelText: 'Reason'),
        items: [for (final e in _returnReasons.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
        onChanged: (v) => setState(() => reason = v!),
      ),
      const SizedBox(height: 10),
      TextField(controller: comments, maxLines: 3, decoration: const InputDecoration(labelText: 'Comments (optional)')),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: picked.isEmpty
            ? null
            : () => Navigator.pop(context, {
                  'items': [for (final e in picked) {'orderItemId': e.key, 'quantity': e.value}],
                  'reason': reason,
                  'comments': comments.text.trim().isEmpty ? null : comments.text.trim(),
                }),
        child: const Text('Request return'),
      ),
    ]);
  }
}

// ── Profile & password ──
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileState();
}

class _ProfileState extends ConsumerState<ProfileScreen> {
  late final me = ref.read(sessionProvider).valueOrNull ?? {};
  late final first = TextEditingController(text: me['firstName'] ?? '');
  late final last = TextEditingController(text: me['lastName'] ?? '');
  late final phone = TextEditingController(text: me['phone'] ?? '');
  final current = TextEditingController(), next = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    for (final c in [first, last, phone, current, next]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _do(Future<void> Function() f, String ok) async {
    setState(() => busy = true);
    try {
      await f();
      if (mounted) _toast(context, ok);
    } catch (e) {
      if (mounted) _toast(context, '$e');
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.read(apiProvider);
    final card = BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r22));
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: card,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _title('Your details'),
            TextField(controller: first, decoration: const InputDecoration(labelText: 'First name')),
            const SizedBox(height: 10),
            TextField(controller: last, decoration: const InputDecoration(labelText: 'Last name')),
            const SizedBox(height: 10),
            TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 6),
            Text(me['email'] ?? '', style: const TextStyle(color: Brand.muted, fontSize: 12)),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: busy
                  ? null
                  : () => _do(() async {
                        await api.patch('/users/me', {
                          'firstName': first.text.trim(),
                          'lastName': last.text.trim(),
                          'phone': phone.text.trim().isEmpty ? null : phone.text.trim(),
                        });
                        ref.invalidate(sessionProvider);
                      }, 'Profile saved'),
              child: const Text('Save'),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: card,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _title('Password'),
            TextField(
              controller: current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current password', helperText: 'Leave empty if you never set one'),
            ),
            const SizedBox(height: 10),
            TextField(controller: next, obscureText: true, decoration: const InputDecoration(labelText: 'New password (min 8)')),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: busy
                  ? null
                  : () {
                      if (next.text.length < 8) return _toast(context, 'New password needs at least 8 characters');
                      _do(() async {
                        await api.post('/users/me/password', {
                          if (current.text.isNotEmpty) 'currentPassword': current.text,
                          'newPassword': next.text,
                        });
                        current.clear();
                        next.clear();
                      }, 'Password changed');
                    },
              child: const Text('Change password'),
            ),
          ]),
        ),
      ]),
    );
  }
}
