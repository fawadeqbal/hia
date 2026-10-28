/** "Rs 1,299.00" / "$1,299.00" — uses Intl currency formatting. */
export function formatMoney(
  amount: number | null | undefined,
  currency = 'USD',
  locale = 'en-US',
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** "11 Oct 2026" — pass a locale to change the format. */
export function formatDate(iso: string | null | undefined, locale = 'en-GB'): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "11 Oct 2026, 14:05" */
export function formatDateTime(iso: string | null | undefined, locale = 'en-GB'): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
