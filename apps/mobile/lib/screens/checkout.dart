import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../checkout_api.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';

/// Native checkout: address → delivery per seller → payment → savings → place.
/// Every change re-quotes on the API so totals, fees and availability are always the server's.
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutState();
}

class _CheckoutState extends ConsumerState<CheckoutScreen> {
  final _form = GlobalKey<FormState>();
  final idempotencyKey = newIdempotencyKey();
  final email = TextEditingController();
  final fullName = TextEditingController();
  final phone = TextEditingController();
  final line1 = TextEditingController();
  final city = TextEditingController();
  final state = TextEditingController();
  final postal = TextEditingController();
  final coupon = TextEditingController();
  final note = TextEditingController();

  String? addressId; // saved address, or null = new address
  bool addressPicked = false;
  String? paymentMethod;
  final shippingRateIds = <String, String>{};
  String? couponCode;
  bool redeemPoints = false;

  Map<String, dynamic>? quote;
  String? quoteError;
  bool quoting = false;
  bool placing = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    for (final c in [city, state]) {
      c.addListener(_requote);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadQuote());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _requote() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), _loadQuote);
  }

  Map<String, dynamic> _quoteBody() => {
        if (paymentMethod != null) 'paymentMethod': paymentMethod,
        if (addressId != null) 'addressId': addressId,
        if (addressId == null && city.text.trim().isNotEmpty)
          'destination': {'countryCode': 'PK', 'city': city.text.trim(), 'state': state.text.trim().isEmpty ? null : state.text.trim()},
        'shippingRateIds': shippingRateIds,
        'couponCode': couponCode,
        'redeemPoints': redeemPoints,
        if (email.text.contains('@')) 'email': email.text.trim(),
      };

  Future<void> _loadQuote() async {
    setState(() => quoting = true);
    try {
      final q = await ref.read(checkoutApiProvider).quote(_quoteBody());
      setState(() {
        quote = q;
        quoteError = null;
        // The API may switch the method (e.g. COD above its limit) — follow it.
        paymentMethod = (q['selectedPaymentMethod'] as String?) ?? paymentMethod;
      });
    } catch (e) {
      setState(() => quoteError = '$e');
    } finally {
      if (mounted) setState(() => quoting = false);
    }
  }

  Future<void> _place() async {
    final signedIn = ref.read(apiProvider).signedIn;
    if (addressId == null && !(_form.currentState?.validate() ?? false)) return;
    setState(() => placing = true);
    try {
      final res = await ref.read(checkoutApiProvider).place({
        if (!signedIn) 'email': email.text.trim().toLowerCase(),
        if (addressId != null) 'addressId': addressId,
        if (addressId == null)
          'address': {
            'fullName': fullName.text.trim(),
            'phone': phone.text.trim(),
            'line1': line1.text.trim(),
            'city': city.text.trim(),
            'state': state.text.trim().isEmpty ? null : state.text.trim(),
            'postalCode': postal.text.trim().isEmpty ? null : postal.text.trim(),
            'countryCode': 'PK',
          },
        if (signedIn && addressId == null) 'saveAddress': true,
        'paymentMethod': paymentMethod,
        'shippingRateIds': shippingRateIds,
        'couponCode': (quote?['coupon'] as Map?)?['applied'] == true ? couponCode : null,
        'redeemPoints': redeemPoints,
        'customerNote': note.text.trim().isEmpty ? null : note.text.trim(),
        'idempotencyKey': idempotencyKey,
      });
      ref.invalidate(cartProvider);
      final order = res['order'] as Map;
      final payment = res['payment'] as Map?;
      if (payment != null) {
        // Card / wallet: pay on the gateway's secure page, then come back to the order.
        await launchUrl(Uri.parse(payment['redirectUrl'] as String), mode: LaunchMode.externalApplication);
      }
      if (!mounted) return;
      final q = Uri(queryParameters: {if (!signedIn) 'email': email.text.trim().toLowerCase(), if (payment != null) 'paying': '1'}).query;
      context.go('/order/${order['orderNumber']}${q.isEmpty ? '' : '?$q'}');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      _loadQuote(); // stock or prices may have changed
    } finally {
      if (mounted) setState(() => placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(apiProvider).signedIn;
    final addresses = ref.watch(addressesProvider);
    final q = quote;
    final currency = (q?['currency'] ?? 'USD') as String;

    // Default to the customer's default address once.
    addresses.whenData((list) {
      if (!addressPicked && list.isNotEmpty) {
        addressPicked = true;
        final def = list.firstWhere((a) => a['isDefault'] == true, orElse: () => list.first);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          setState(() => addressId = def['id'] as String);
          _loadQuote();
        });
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: q == null && quoteError == null
          ? loading()
          : Form(
              key: _form,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 140), children: [
                if (quoteError != null) _Notice(quoteError!, error: true),
                for (final p in ((q?['problems'] as List?) ?? [])) _Notice('$p', error: true),

                // 1. Address
                _Card('1. Delivery address', children: [
                  if (!signedIn) ...[
                    _field(email, 'Email', TextInputType.emailAddress, (v) => v!.contains('@') ? null : 'Enter a valid email'),
                    const Text('Your receipt and order updates go here.', style: TextStyle(color: Brand.muted, fontSize: 12)),
                    const SizedBox(height: 10),
                  ],
                  ...addresses.maybeWhen(
                    orElse: () => <Widget>[],
                    data: (list) => [
                      for (final a in list)
                        _Option(
                          selected: addressId == a['id'],
                          title: '${a['label'] ?? 'Address'} · ${a['fullName']}',
                          subtitle: '${a['line1']}, ${a['city']}',
                          onTap: () {
                            setState(() => addressId = a['id'] as String);
                            _loadQuote();
                          },
                        ),
                      if (list.isNotEmpty)
                        _Option(
                          selected: addressId == null,
                          title: 'Use a new address',
                          onTap: () {
                            setState(() => addressId = null);
                            _loadQuote();
                          },
                        ),
                    ],
                  ),
                  if (addressId == null) ...[
                    _field(fullName, 'Full name', TextInputType.name, _required),
                    _field(phone, 'Phone', TextInputType.phone, _required),
                    _field(line1, 'Street address', TextInputType.streetAddress, _required),
                    Row(children: [
                      Expanded(child: _field(city, 'City', TextInputType.text, _required)),
                      const SizedBox(width: 10),
                      Expanded(child: _field(state, 'Province', TextInputType.text, null)),
                    ]),
                    _field(postal, 'Postal code (optional)', TextInputType.number, null),
                  ],
                ]),

                // 2. Delivery per seller
                if (q != null)
                  _Card('2. Delivery', children: [
                    for (final g in (q['groups'] as List)) ...[
                      Text('Sold by ${g['vendor']['name']} · ${(g['items'] as List).length} item(s)',
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      if ((g['shippingOptions'] as List).isEmpty)
                        const Text('This seller doesn’t deliver to this address.', style: TextStyle(color: Colors.red)),
                      for (final o in (g['shippingOptions'] as List))
                        _Option(
                          selected: o['rateId'] == (shippingRateIds[g['vendor']['id']] ?? g['shippingRateId']) ||
                              (g['shippingOptions'] as List).length == 1,
                          title: o['name'] as String,
                          subtitle: o['estimatedDays'] as String?,
                          trailing: (o['price'] as num) == 0 ? 'Free' : money(o['price'] as num, currency),
                          onTap: o['rateId'] == null
                              ? null
                              : () {
                                  setState(() => shippingRateIds[g['vendor']['id'] as String] = o['rateId'] as String);
                                  _loadQuote();
                                },
                        ),
                      const SizedBox(height: 8),
                    ],
                  ]),

                // 3. Payment
                if (q != null)
                  _Card('3. Payment', children: [
                    for (final o in (q['paymentOptions'] as List))
                      _Option(
                        selected: paymentMethod == o['method'],
                        enabled: o['available'] == true,
                        title: o['label'] as String,
                        subtitle: [
                          o['description'],
                          if ((o['fee'] as num? ?? 0) > 0) 'A ${money(o['fee'] as num, currency)} fee applies.',
                          o['reason'],
                        ].whereType<String>().join(' '),
                        onTap: o['available'] == true
                            ? () {
                                setState(() => paymentMethod = o['method'] as String);
                                _loadQuote();
                              }
                            : null,
                      ),
                  ]),

                // 4. Savings
                if (q != null)
                  _Card('Savings (optional)', children: [
                    if (q['loyalty'] != null && ((q['loyalty'] as Map)['balance'] as num? ?? 0) > 0)
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: redeemPoints,
                        activeColor: Brand.violet,
                        title: const Text('Use my points', style: TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${(q['loyalty'] as Map)['balance']} points available'),
                        onChanged: (v) {
                          setState(() => redeemPoints = v);
                          _loadQuote();
                        },
                      ),
                    Row(children: [
                      Expanded(child: TextField(controller: coupon, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'Coupon code'))),
                      const SizedBox(width: 8),
                      FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: Brand.ink, minimumSize: const Size(90, 50)),
                        onPressed: () {
                          setState(() => couponCode = coupon.text.trim().isEmpty ? null : coupon.text.trim());
                          _loadQuote();
                        },
                        child: const Text('Apply'),
                      ),
                    ]),
                    if (q['coupon'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          (q['coupon'] as Map)['applied'] == true ? 'Coupon applied ✓' : '${(q['coupon'] as Map)['message'] ?? 'Coupon not valid'}',
                          style: TextStyle(color: (q['coupon'] as Map)['applied'] == true ? const Color(0xFF047857) : Colors.red),
                        ),
                      ),
                    const SizedBox(height: 10),
                    TextField(controller: note, maxLines: 2, decoration: const InputDecoration(hintText: 'Note for the seller (optional)')),
                  ]),

                // Summary
                if (q != null)
                  _Card('Order summary', children: [
                    _Line('Subtotal', money(q['subtotal'] as num, currency)),
                    _Line('Delivery', (q['shippingTotal'] as num) == 0 ? 'Free' : money(q['shippingTotal'] as num, currency)),
                    if ((q['discountTotal'] as num) > 0) _Line('Discounts', '−${money(q['discountTotal'] as num, currency)}', green: true),
                    if ((q['codFee'] as num? ?? 0) > 0) _Line('Cash on delivery fee', money(q['codFee'] as num, currency)),
                    if ((q['taxAdded'] as num? ?? 0) > 0) _Line('Tax', money(q['taxAdded'] as num, currency)),
                    const Divider(height: 20),
                    _Line('Total', money(q['grandTotal'] as num, currency), bold: true),
                  ]),
              ]),
            ),
      bottomSheet: q == null
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Brand.line))),
                child: FilledButton(
                  onPressed: placing || quoting || q['canPlace'] != true || paymentMethod == null ? null : _place,
                  child: Text(placing
                      ? 'Placing order…'
                      : '${paymentMethod == 'COD' ? 'Place order' : 'Continue to payment'} · ${money(q['grandTotal'] as num, currency)}'),
                ),
              ),
            ),
    );
  }

  String? _required(String? v) => (v ?? '').trim().isEmpty ? 'Required' : null;

  Widget _field(TextEditingController c, String label, TextInputType type, String? Function(String?)? validator) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextFormField(controller: c, keyboardType: type, validator: validator, decoration: InputDecoration(labelText: label)),
      );
}

class _Card extends StatelessWidget {
  const _Card(this.title, {required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r22)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ...children,
        ]),
      );
}

class _Option extends StatelessWidget {
  const _Option({required this.selected, required this.title, this.subtitle, this.trailing, this.onTap, this.enabled = true});
  final bool selected;
  final bool enabled;
  final String title;
  final String? subtitle;
  final String? trailing;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Opacity(
        opacity: enabled ? 1 : 0.5,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: InkWell(
            borderRadius: BorderRadius.circular(Brand.r16),
            onTap: onTap,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: selected ? Brand.violetSoft.withOpacity(.5) : Colors.white,
                borderRadius: BorderRadius.circular(Brand.r16),
                border: Border.all(color: selected ? Brand.violet : Brand.line),
              ),
              child: Row(children: [
                Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: selected ? Brand.violet : Brand.muted, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                    if (subtitle != null && subtitle!.isNotEmpty) Text(subtitle!, style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
                  ]),
                ),
                if (trailing != null) Text(trailing!, style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
            ),
          ),
        ),
      );
}

class _Line extends StatelessWidget {
  const _Line(this.label, this.value, {this.bold = false, this.green = false});
  final String label;
  final String value;
  final bool bold;
  final bool green;
  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontSize: bold ? 18 : 14.5,
      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
      color: green ? const Color(0xFF047857) : Brand.ink,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [Text(label, style: style), const Spacer(), Text(value, style: style)]),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.text, {this.error = false});
  final String text;
  final bool error;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: error ? const Color(0xFFFDEBEF) : Brand.yellowSoft, borderRadius: BorderRadius.circular(Brand.r14)),
        child: Text(text, style: TextStyle(color: error ? const Color(0xFF9F1239) : Brand.ink)),
      );
}
