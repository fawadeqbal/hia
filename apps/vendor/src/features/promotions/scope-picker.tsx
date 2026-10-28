'use client';

import { useMemo, useState } from 'react';
import { Input } from '@ecommerce/ui';

/** Searchable checkbox list for "which products / categories / sellers" (empty = all). */
export function ScopePicker({
  label,
  options,
  value,
  onChange,
  emptyHint = 'None selected = all',
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  emptyHint?: string;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())),
    [options, q],
  );
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">
          {value.length ? `${value.length} selected` : emptyHint}
          {value.length ? (
            <button
              type="button"
              className="ml-2 text-brand-700 hover:underline"
              onClick={() => onChange([])}
            >
              clear
            </button>
          ) : null}
        </span>
      </div>
      {options.length > 8 ? (
        <Input
          aria-label={`Search ${label}`}
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      ) : null}
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
        {shown.length === 0 ? <p className="text-xs text-gray-400">Nothing to choose</p> : null}
        {shown.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
          >
            <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function flattenCategories(
  nodes: { id: string; name: string; children: unknown[] }[],
  prefix = '',
): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${prefix}${n.name}` },
    ...flattenCategories(
      n.children as { id: string; name: string; children: unknown[] }[],
      `${prefix}${n.name} › `,
    ),
  ]);
}
