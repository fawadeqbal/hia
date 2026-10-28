import * as React from 'react';
import { cn } from '../lib/cn';

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** % change vs the previous period; null = no comparison possible. */
  change?: number | null;
  /** Whether a rise is good news (sales) or bad (cancellations). */
  goodWhenUp?: boolean;
  changeLabel?: string;
  className?: string;
}

/** KPI tile: label, big value, signed % change coloured by whether the direction is good. */
export function StatTile({
  label,
  value,
  change,
  goodWhenUp = true,
  changeLabel,
  className,
}: StatTileProps) {
  const hasChange = change !== undefined;
  const good = change !== null && change !== undefined && change !== 0 && change > 0 === goodWhenUp;
  const bad = change !== null && change !== undefined && change !== 0 && !good;
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-4 shadow-sm', className)}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
      {hasChange ? (
        <p className="mt-1 text-xs text-gray-500">
          <span className={cn('font-medium', good && 'text-green-700', bad && 'text-red-700')}>
            {change === null ? 'New' : `${change > 0 ? '▲ +' : change < 0 ? '▼ ' : ''}${change}%`}
          </span>
          {changeLabel ? <span> {changeLabel}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
