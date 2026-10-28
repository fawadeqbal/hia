import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers.dart';
import '../theme.dart';

// NestJS: GET /reviews/products/:id · GET /questions/products/:id · POST /questions
final _reviewsProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async =>
    Map<String, dynamic>.from(await ref.read(apiProvider).get('/reviews/products/$id', query: {'limit': 5}) as Map));
final _questionsProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, id) async {
  final res = await ref.read(apiProvider).get('/questions/products/$id', query: {'limit': 5}) as Map;
  return (res['items'] as List).map((e) => Map<String, dynamic>.from(e)).toList();
});

String _date(String iso) => DateFormat('d MMM y').format(DateTime.parse(iso).toLocal());
const _h = TextStyle(fontSize: 16, fontWeight: FontWeight.w800);

Widget _stars(num r, {double size = 15}) => Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 1; i <= 5; i++)
        Icon(i <= r.round() ? Icons.star_rounded : Icons.star_border_rounded, size: size, color: Brand.yellow),
    ]);

/// Reviews + Q&A under the product description.
class ProductExtras extends ConsumerWidget {
  const ProductExtras({super.key, required this.productId});
  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviews = ref.watch(_reviewsProvider(productId)).valueOrNull;
    final questions = ref.watch(_questionsProvider(productId)).valueOrNull;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (reviews != null) ..._reviews(reviews),
      const SizedBox(height: 22),
      Row(children: [
        const Expanded(child: Text('Questions & answers', style: _h)),
        TextButton(onPressed: () => _ask(context, ref), child: const Text('Ask')),
      ]),
      if (questions != null && questions.isEmpty)
        const Text('No questions yet — ask the seller anything.', style: TextStyle(color: Brand.muted)),
      for (final q in questions ?? <Map<String, dynamic>>[])
        Container(
          margin: const EdgeInsets.only(top: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Brand.photo, borderRadius: BorderRadius.circular(Brand.r16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Q: ${q['body']}', style: const TextStyle(fontWeight: FontWeight.w700)),
            for (final a in q['answers'] as List) ...[
              const SizedBox(height: 6),
              Text('A: ${a['body']}', style: const TextStyle(height: 1.4)),
              Text('${a['author']}${a['isVendor'] == true ? ' · Seller' : ''}',
                  style: const TextStyle(fontSize: 11.5, color: Brand.muted)),
            ],
            if ((q['answers'] as List).isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('Waiting for an answer', style: TextStyle(fontSize: 12, color: Brand.muted)),
              ),
          ]),
        ),
    ]);
  }

  List<Widget> _reviews(Map<String, dynamic> r) {
    final s = r['summary'] as Map;
    final items = (r['items'] as List).map((e) => Map<String, dynamic>.from(e));
    final count = s['count'] as num;
    final dist = (s['distribution'] as List).cast<num>();
    return [
      const SizedBox(height: 22),
      const Text('Reviews', style: _h),
      const SizedBox(height: 8),
      if (count == 0)
        const Text('No reviews yet.', style: TextStyle(color: Brand.muted))
      else ...[
        Row(children: [
          Column(children: [
            Text((s['average'] as num).toStringAsFixed(1), style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800)),
            _stars(s['average'] as num),
            Text('$count review${count == 1 ? '' : 's'}', style: const TextStyle(fontSize: 12, color: Brand.muted)),
          ]),
          const SizedBox(width: 18),
          Expanded(
            child: Column(children: [
              for (var i = 4; i >= 0; i--)
                Row(children: [
                  SizedBox(width: 14, child: Text('${i + 1}', style: const TextStyle(fontSize: 12, color: Brand.muted))),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: count == 0 ? 0 : dist[i] / count,
                        minHeight: 6,
                        backgroundColor: Brand.photo,
                        color: Brand.yellow,
                      ),
                    ),
                  ),
                ]),
            ]),
          ),
        ]),
        for (final v in items)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                _stars(v['rating'] as num, size: 14),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(v['title'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ]),
              if (v['body'] != null) Text(v['body'], style: const TextStyle(height: 1.4)),
              Text('${v['author']}${v['verified'] == true ? ' · Verified purchase' : ''} · ${_date(v['createdAt'])}',
                  style: const TextStyle(fontSize: 11.5, color: Brand.muted)),
              if (v['vendorReply'] != null)
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Brand.violetSoft, borderRadius: BorderRadius.circular(12)),
                  child: Text('Seller: ${v['vendorReply']}', style: const TextStyle(fontSize: 13)),
                ),
            ]),
          ),
      ],
    ];
  }

  Future<void> _ask(BuildContext context, WidgetRef ref) async {
    final api = ref.read(apiProvider);
    if (!api.signedIn) {
      context.push('/login');
      return;
    }
    final c = TextEditingController();
    final body = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      builder: (s) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(s).viewInsets.bottom + 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Ask the seller', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          TextField(controller: c, autofocus: true, maxLines: 3, decoration: const InputDecoration(hintText: 'Your question')),
          const SizedBox(height: 12),
          FilledButton(onPressed: () => Navigator.pop(s, c.text.trim()), child: const Text('Post question')),
        ]),
      ),
    );
    c.dispose();
    if (body == null || body.length < 5) return;
    try {
      await api.post('/questions', {'productId': productId, 'body': body});
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Question posted — it appears once approved')));
      }
      ref.invalidate(_questionsProvider(productId));
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}
