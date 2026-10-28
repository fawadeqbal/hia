import * as React from 'react';

export interface BarListItem {
  key: string;
  label: React.ReactNode;
  value: number;
  /** Text shown at the bar end, e.g. "$1,204.00 · 12 orders". */
  display: string;
}

/** Ranked horizontal bars (top products, status breakdown). One hue; values as text, never colour alone. */
export function BarList({
  items,
  empty = 'No data for this period.',
}: {
  items: BarListItem[];
  empty?: string;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-gray-500">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-gray-700">{item.label}</span>
            <span className="shrink-0 text-gray-900">{item.display}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-brand-500"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
