import * as React from 'react';

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
}

/** Vertical list of events (order history, audit trails). */
export function Timeline({
  items,
  empty = 'Nothing yet.',
}: {
  items: TimelineItem[];
  empty?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <ol className="relative space-y-4 border-l border-gray-200 pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
          <p className="text-sm font-medium text-gray-900">{item.title}</p>
          {item.meta ? <p className="text-xs text-gray-500">{item.meta}</p> : null}
          {item.description ? (
            <p className="mt-1 text-sm text-gray-600">{item.description}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
