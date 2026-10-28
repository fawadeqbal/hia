'use client';

import { useState } from 'react';
import { Button } from '@ecommerce/ui';
import { downloadExcel, excelFilename, type ExcelColumn } from '@/lib/excel';

/**
 * "Download Excel" for any list: loads the rows (usually every page with the current filters),
 * writes them with the given columns and starts the download.
 */
export function ExcelDownloadButton<T>({
  name,
  columns,
  load,
  label = 'Download Excel',
}: {
  /** File name without date / extension, e.g. "stock". */
  name: string;
  columns: ExcelColumn<T>[];
  load: () => Promise<T[]>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await downloadExcel(excelFilename(name), columns, await load(), name);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Download failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        <DownloadIcon />
        {label}
      </Button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M10 3v10m0 0-4-4m4 4 4-4M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
