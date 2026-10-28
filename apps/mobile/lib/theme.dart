import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Same tokens as the web store (apps/web/tailwind.config.ts).
class Brand {
  static const violet = Color(0xFF6445DF);
  static const violetDark = Color(0xFF532BC7);
  static const violetSoft = Color(0xFFEBEBFF);
  static const yellow = Color(0xFFFFD32E);
  static const yellowSoft = Color(0xFFFFEFB1);
  static const ink = Color(0xFF1B1830);
  static const muted = Color(0xFF6C6883);
  static const line = Color(0xFFE6E3F0);
  static const canvas = Color(0xFFF5F4FA);
  static const photo = Color(0xFFF6F6F8);
  static const tints = [
    Color(0xFFEEE9FE), Color(0xFFFFF4CC), Color(0xFFE6F6EE),
    Color(0xFFFDEBEF), Color(0xFFE6F1FD), Color(0xFFFCE7F3),
  ];
  static const r14 = 14.0, r16 = 16.0, r22 = 22.0, r28 = 28.0;
}

ThemeData buildTheme() {
  final base = ThemeData(useMaterial3: true, colorSchemeSeed: Brand.violet, brightness: Brightness.light);
  final text = GoogleFonts.outfitTextTheme(base.textTheme).apply(bodyColor: Brand.ink, displayColor: Brand.ink);
  return base.copyWith(
    scaffoldBackgroundColor: Brand.canvas,
    textTheme: text,
    colorScheme: base.colorScheme.copyWith(primary: Brand.violet, secondary: Brand.yellow, surface: Colors.white),
    appBarTheme: AppBarTheme(
      backgroundColor: Brand.violet,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.violet,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Brand.r16)),
        textStyle: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(Brand.r14), borderSide: const BorderSide(color: Brand.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Brand.r14), borderSide: const BorderSide(color: Brand.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Brand.r14), borderSide: const BorderSide(color: Brand.violet, width: 1.5)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: Brand.violetSoft,
      labelTextStyle: WidgetStatePropertyAll(GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600)),
    ),
  );
}
