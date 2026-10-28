import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../checkout_api.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_actions.dart';

/// Order placed / order detail. While a card payment is pending it polls the API (the Stripe
/// webhook confirms it), and offers "Pay now" to reopen the gateway page.
class OrderScreen extends ConsumerStatefulWidget {
  const OrderScreen({super.key, required this.number, this.email, this.paying = false});
  final String number;
  final String? email;
  final bool paying;
  @override
  ConsumerState<OrderScreen> createState() => _OrderState();
}

class _OrderState extends ConsumerState<OrderScreen> with WidgetsBindingObserver {
  Map<String, dynamic>? order;
  String? error;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _poll = Timer.periodic(const Duration(seconds: 4), (_) {
      if (order?['paymentStatus'] == 'PENDING' && order?['paymentMethod'] != 'COD') _load();
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Coming back from the payment page: refresh straight away.
  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.resumed) _load();
  }

  Future<void> _load() async {
    try {
      final o = await ref.read(checkoutApiProvider).order(widget.number, email: widget.email);
      if (mounted) setState(() => order = o);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> _payNow() async {
    try {
      final s = await ref.read(apiProvider).post('/payments/orders/${widget.number}/pay', {if (widget.email != null) 'email': widget.email});
      await launchUrl(Uri.parse((s as Map)['redirectUrl'] as String), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = order;
    if (o == null) {
      return Scaffold(appBar: AppBar(title: const Text('Order')), body: error != null ? failed(error!, _load) : loading());
    }
    final currency = (o['currency'] ?? 'USD') as String;
    final paid = o['paymentStatus'] == 'PAID' || o['paymentMethod'] == 'COD';
    final cancelled = o['status'] == 'CANCELLED';
    final waiting = !paid && !cancelled;
    final items = [for (final vo in (o['vendorOrders'] as List? ?? [])) ...(vo['items'] as List)];

    return Scaffold(
      appBar: AppBar(title: Text(o['orderNumber'] as String)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          // Status hero
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Brand.r28),
              color: cancelled ? const Color(0xFFFDEBEF) : waiting ? Brand.yellowSoft : const Color(0xFFE6F6EE),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(cancelled ? Icons.cancel_outlined : waiting ? Icons.hourglass_top_rounded : Icons.check_circle_rounded,
                  size: 40, color: cancelled ? Colors.red : waiting ? const Color(0xFFB45309) : const Color(0xFF047857)),
              const SizedBox(height: 8),
              Text(
                cancelled ? 'Order cancelled' : waiting ? 'Waiting for your payment' : 'Thank you! Your order is placed',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                cancelled
                    ? (o['cancelReason'] as String? ?? '')
                    : waiting
                        ? 'Your items are reserved while you pay. We’ll update this page as soon as the payment goes through.'
                        : 'Status: ${(o['status'] as String).replaceAll('_', ' ').toLowerCase()}',
                style: const TextStyle(color: Brand.muted),
              ),
              if (waiting && o['canPay'] == true) ...[
                const SizedBox(height: 12),
                FilledButton(onPressed: _payNow, child: const Text('Pay now')),
              ],
            ]),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r22)),
            child: Column(children: [
              for (final it in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(children: [
                    SizedBox(width: 56, height: 56, child: Photo(it['imageUrl'] as String?, padding: 4, radius: 12)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(it['productName'] as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text('${it['quantity']} × ${money(it['unitPrice'] as num, currency)}', style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
                      ]),
                    ),
                    Text(money(it['total'] as num, currency), style: const TextStyle(fontWeight: FontWeight.w800)),
                  ]),
                ),
              const Divider(),
              Row(children: [
                const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                const Spacer(),
                Text(money(o['grandTotal'] as num, currency), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              ]),
            ]),
          ),
          OrderActions(order: o, onChanged: _load),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Brand.ink),
            onPressed: () => context.go('/'),
            child: const Text('Continue shopping'),
          ),
        ]),
      ),
    );
  }
}
