import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../theme.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final me = session.valueOrNull;
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Member card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Brand.r22),
            gradient: const LinearGradient(colors: [Color(0xFF6447E6), Color(0xFF3B2390)]),
          ),
          child: Row(children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: Brand.yellow,
              child: Text(
                me == null ? '?' : '${me['firstName'][0]}${me['lastName'][0]}',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Brand.ink),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(me == null ? 'Welcome!' : '${me['firstName']} ${me['lastName']}',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                Text(me == null ? 'Sign in to see orders and points' : me['email'],
                    style: const TextStyle(color: Colors.white70)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        if (me == null)
          FilledButton(onPressed: () => context.push('/login'), child: const Text('Sign in'))
        else ...[
          _Item(Icons.inventory_2_outlined, 'My orders', '/account/orders'),
          _Item(Icons.favorite_border, 'Wishlist', '/account/wishlist'),
          _Item(Icons.star_border_rounded, 'Points & rewards', '/account/points'),
          _Item(Icons.place_outlined, 'Addresses', '/account/addresses'),
          _Item(Icons.person_outline, 'Profile & password', '/account/profile'),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: () => ref.read(sessionProvider.notifier).logout(),
            icon: const Icon(Icons.logout, color: Colors.red),
            label: const Text('Sign out', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w700)),
          ),
        ],
      ]),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item(this.icon, this.label, this.to);
  final IconData icon;
  final String label;
  final String to;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.r16)),
        child: ListTile(
          leading: Icon(icon, color: Brand.violet),
          title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          trailing: const Icon(Icons.chevron_right, color: Brand.muted),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Brand.r16)),
          onTap: () => GoRouter.of(context).push(to),
        ),
      );
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginState();
}

class _LoginState extends ConsumerState<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  String? error;

  Future<void> _submit() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(sessionProvider.notifier).login(email.text.trim(), password.text);
      if (mounted) context.pop();
    } catch (e) {
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Sign in')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          const Text('Welcome back', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
          const Text('Items in your cart are kept when you sign in.', style: TextStyle(color: Brand.muted)),
          const SizedBox(height: 20),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
          const SizedBox(height: 12),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password'), onSubmitted: (_) => _submit()),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(error!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 20),
          FilledButton(onPressed: busy ? null : _submit, child: Text(busy ? 'Signing in…' : 'Sign in')),
        ]),
      );
}
