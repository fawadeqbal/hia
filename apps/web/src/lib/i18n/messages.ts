/**
 * Storefront interface text. Add a language: copy `en`, translate the values, add it to MESSAGES and
 * activate the language in Admin → Settings → Localization. Missing keys fall back to English.
 */
export const en = {
  'header.cart': 'Cart',
  'header.wishlist': 'Wishlist',
  'header.signIn': 'Sign in',
  'header.signOut': 'Sign out',
  'header.trackOrder': 'Track order',
  'header.hi': 'Hi, {name}',
  'header.categories': 'Categories',
  'header.search': 'Search',
  'header.searchPlaceholder': 'What are you looking for today?',
  'header.account': 'Account',
  'header.home': 'Home',
  'header.deals': 'Deals',
  'locale.currency': 'Currency',
  'locale.language': 'Language',
  'checkout.chargedIn': 'Prices shown in {display} are approximate. You pay in {base}.',
  'checkout.tax': 'Tax',
  'checkout.includesTax': 'Includes {amount} tax',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Partial<Record<MessageKey, string>>;

export const MESSAGES: Record<string, Messages> = {
  en,
  // ur: { 'header.cart': 'ٹوکری', … }  ← add translations here
};

export function translate(
  lang: string,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const text = MESSAGES[lang]?.[key] ?? MESSAGES[lang.split('-')[0] ?? '']?.[key] ?? en[key];
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => String(vars[k] ?? m)) : text;
}
