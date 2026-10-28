'use client';

import { useMemo, useState } from 'react';
import {
  REPORT_PRESETS,
  REPORT_PRESET_LABELS,
  presetRange,
  todayInZone,
  type ReportGranularity,
  type SeriesPoint,
  periodLabels,
} from '@ecommerce/types';
import { formatMoney, type ColumnDatum, type RangePreset, type RangeValue } from '@ecommerce/ui';

/** Range state with presets based on the viewer's today (the API applies the store time zone). */
export function useReportRange(initial: (typeof REPORT_PRESETS)[number] = '30d') {
  const today = useMemo(() => todayInZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const presets: RangePreset[] = useMemo(
    () =>
      REPORT_PRESETS.map((key) => ({
        key,
        label: REPORT_PRESET_LABELS[key],
        ...presetRange(key, today),
      })),
    [today],
  );
  const [range, setRange] = useState<RangeValue>(() => presetRange(initial, today));
  return { range, setRange, presets, today };
}

export function salesColumns(
  series: SeriesPoint[],
  g: ReportGranularity,
  currency: string,
): ColumnDatum[] {
  return series.map((p) => ({
    ...periodLabels(p.period, g),
    value: p.sales,
    display: formatMoney(p.sales, currency),
  }));
}

export function orderColumns(series: SeriesPoint[], g: ReportGranularity): ColumnDatum[] {
  return series.map((p) => ({
    ...periodLabels(p.period, g),
    value: p.orders,
    display: `${p.orders} ${p.orders === 1 ? 'order' : 'orders'}`,
  }));
}

export const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
