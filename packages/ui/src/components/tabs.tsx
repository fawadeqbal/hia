import * as React from 'react';
import { cn } from '../lib/cn';

export interface TabItem<V extends string> {
  value: V;
  label: string;
  count?: number;
}

/** Segmented filter tabs (e.g. status filters on list screens). */
export function Tabs<V extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1', className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="ml-1.5 text-xs text-gray-400">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
