'use client';

import * as React from 'react';
import { cn } from '../lib/cn';

export interface RangeValue {
  from: string;
  to: string;
}

export interface RangePreset extends RangeValue {
  key: string;
  label: string;
}

/** Preset buttons + custom from/to dates (YYYY-MM-DD). The active preset is highlighted. */
export function RangePicker({
  value,
  presets,
  onChange,
  max,
}: {
  value: RangeValue;
  presets: RangePreset[];
  onChange: (value: RangeValue) => void;
  /** Latest selectable date (usually today). */
  max?: string;
}) {
  const active = presets.find((p) => p.from === value.from && p.to === value.to)?.key;
  const input =
    'h-9 rounded-lg border border-gray-300 px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Date range"
        className="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1"
      >
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={active === p.key}
            onClick={() => onChange({ from: p.from, to: p.to })}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active === p.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <input
          type="date"
          aria-label="From"
          className={input}
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to })}
        />
        <span>–</span>
        <input
          type="date"
          aria-label="To"
          className={input}
          value={value.to}
          min={value.from}
          max={max}
          onChange={(e) => e.target.value && onChange({ from: value.from, to: e.target.value })}
        />
      </div>
    </div>
  );
}
