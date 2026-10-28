'use client';

import * as React from 'react';
import { compactNumber } from '../lib/csv';

export interface ColumnDatum {
  /** Axis label (short), e.g. "12 Oct". */
  label: string;
  value: number;
  /** Tooltip text for the value, e.g. "$1,204.00". */
  display: string;
  /** Tooltip heading, e.g. "Mon 12 Oct 2026". Defaults to label. */
  title?: string;
}

/** Up to ~5 clean ticks from 0 to a round maximum. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/**
 * Single-series column chart (SVG, no dependencies). Thin columns with 4px rounded tops,
 * hairline grid, compact y ticks, hover/focus tooltip, and a data table for screen readers.
 */
export function ColumnChart({
  data,
  height = 220,
  ariaLabel,
  formatTick = compactNumber,
}: {
  data: ColumnDatum[];
  height?: number;
  ariaLabel: string;
  formatTick?: (n: number) => string;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const width = 720;
  const pad = { top: 12, right: 8, bottom: 26, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)));
  const top = ticks[ticks.length - 1] || 1;
  const slot = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;

  const tip = active !== null ? data[active] : null;
  const tipX = active !== null ? pad.left + slot * active + slot / 2 : 0;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-gray-500 text-[11px]"
            >
              {formatTick(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + slot * i + (slot - barW) / 2;
          const h = Math.max(0, (d.value / top) * plotH);
          const r = Math.min(4, barW / 2, h);
          const yTop = pad.top + plotH - h;
          const path =
            h <= 0
              ? ''
              : `M${x},${pad.top + plotH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${pad.top + plotH} Z`;
          return (
            <g key={i}>
              {/* Hit target: the whole slot, taller than the mark. */}
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.title ?? d.label}: ${d.display}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
              {path ? (
                <path
                  d={path}
                  className={active === i ? 'fill-brand-700' : 'fill-brand-500'}
                  pointerEvents="none"
                />
              ) : null}
              {i % labelEvery === 0 ? (
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-gray-500 text-[11px]"
                >
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + plotH}
          y2={pad.top + plotH}
          stroke="#d1d5db"
          strokeWidth={1}
        />
      </svg>

      {tip ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{ left: `${(tipX / width) * 100}%` }}
        >
          <p className="text-gray-500">{tip.title ?? tip.label}</p>
          <p className="font-semibold text-gray-900">{tip.display}</p>
        </div>
      ) : null}

      <details className="mt-2 text-xs text-gray-500">
        <summary className="cursor-pointer select-none">Show data table</summary>
        <table className="mt-2 w-full max-w-sm">
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1 pr-4">{d.title ?? d.label}</td>
                <td className="py-1 text-right text-gray-900">{d.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
