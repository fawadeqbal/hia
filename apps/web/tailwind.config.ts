import type { Config } from 'tailwindcss';
import preset from '@ecommerce/config/tailwind/preset.js';

/**
 * Storefront theme — "KADAM" (footwear). Only the web app uses these values: the shared
 * @ecommerce/ui components are compiled per app, so admin and vendor keep the base preset.
 *
 * Palette: bone canvas, near-black ink, terracotta clay (primary), marigold (highlight).
 * Shape: tight corners (2–12px) — pills stay round. Type: Archivo, condensed for display.
 * Every token is also documented in apps/web/DESIGN_SYSTEM.md.
 */
const config: Config = {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Clay — 600 is the primary action colour (buttons, links, active states).
        brand: {
          50: '#fdf4ef',
          100: '#fae5d9',
          200: '#f3c6ad',
          300: '#e9a07c',
          400: '#dd774b',
          500: '#cf5a2a',
          600: '#b6461c',
          700: '#933818',
          800: '#772f19',
          900: '#622918',
          950: '#36130a',
        },
        // Marigold — highlights, count badges, "new season" moments. Always with ink text.
        accent: { DEFAULT: '#f0bd3f', soft: '#f9e7b4', strong: '#d9a21f' },
        // Warm neutrals: ink #171513, muted #756D62, lines #E4DED4, canvas #F6F3EE.
        gray: {
          50: '#f6f3ee',
          100: '#efebe4',
          200: '#e4ded4',
          300: '#cfc7ba',
          400: '#a39a8c',
          500: '#756d62',
          600: '#554f47',
          700: '#3d3934',
          800: '#282522',
          900: '#171513',
          950: '#0d0c0b',
        },
        // Sale / price-drop red-orange, kept apart from the clay primary so deals read as deals.
        sale: { DEFAULT: '#c8321e', soft: '#fbe3dd' },
        // Soft tiles (categories, trust badges, store avatars). Keys kept for compatibility.
        tint: {
          violet: '#e8e2da', // stone
          yellow: '#f6e6bd', // straw
          mint: '#dde6d2', // sage
          rose: '#f5dccf', // clay wash
          sky: '#d9e3e6', // slate
          pink: '#efdfe1', // blush
        },
        // Product imagery sits on this (photos are multiplied onto it).
        canvas: { DEFAULT: '#efebe4', deep: '#e7e1d8' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
        xl: '8px',
        '2xl': '10px',
        '3xl': '12px',
        '4xl': '14px',
      },
      boxShadow: {
        card: '0 18px 40px -24px rgba(23, 21, 19, 0.35)',
        pop: '0 0 0 1px rgba(23,21,19,.06), 0 24px 60px -18px rgba(23,21,19,.32)',
        drawer: '-24px 0 60px -20px rgba(23,21,19,.35)',
      },
      transitionTimingFunction: {
        // One curve for the whole store: quick start, soft landing.
        out: 'cubic-bezier(.22,1,.36,1)',
        'in-out': 'cubic-bezier(.65,0,.35,1)',
      },
      // Screen and panel transitions (all disabled under prefers-reduced-motion in globals.css).
      keyframes: {
        'page-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(-6px) scale(.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        ticker: {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'none', opacity: '1' },
        },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        bump: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' },
        },
        progress: {
          '0%': { transform: 'scaleX(0)' },
          '60%': { transform: 'scaleX(.7)' },
          '100%': { transform: 'scaleX(.92)' },
        },
      },
      animation: {
        // `backwards`, not `both`: a transform kept after the animation would trap position:fixed
        // children (dialogs, bottom sheets) inside the page instead of the viewport.
        'page-in': 'page-in .32s cubic-bezier(.22,1,.36,1) backwards',
        'fade-in': 'fade-in .2s ease-out both',
        'pop-in': 'pop-in .18s cubic-bezier(.22,1,.36,1) both',
        'sheet-up': 'sheet-up .3s cubic-bezier(.22,1,.36,1) both',
        'rise-in': 'rise-in .5s cubic-bezier(.22,1,.36,1) backwards',
        ticker: 'ticker .45s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        progress: 'progress 2.5s cubic-bezier(.1,.6,.3,1) both',
        bump: 'bump .35s cubic-bezier(.22,1,.36,1)',
      },
      letterSpacing: {
        display: '-0.01em',
        heading: '-0.015em',
        label: '0.08em',
      },
    },
  },
};

export default config;
