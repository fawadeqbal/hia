import * as React from 'react';

export interface DetailItem {
  label: string;
  value: React.ReactNode;
}

/** Label/value rows for detail screens. Empty values render as an em dash. */
export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <dl className="divide-y divide-gray-100">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-3 gap-4 py-2.5 text-sm">
          <dt className="text-gray-500">{item.label}</dt>
          <dd className="col-span-2 break-words text-gray-900">
            {item.value === null || item.value === undefined || item.value === ''
              ? '—'
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
