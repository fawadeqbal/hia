'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ImportResult, ImportRowResult, SheetRow } from '@ecommerce/types';
import { Alert, Badge, Button, Modal } from '@ecommerce/ui';
import { readSpreadsheet } from '@/lib/excel';

const TONE: Record<ImportRowResult['action'], 'green' | 'blue' | 'gray' | 'red'> = {
  create: 'green',
  update: 'blue',
  unchanged: 'gray',
  error: 'red',
};
const ACTION_LABEL: Record<ImportRowResult['action'], string> = {
  create: 'New',
  update: 'Change',
  unchanged: 'No change',
  error: 'Problem',
};

/**
 * "Upload Excel" for any list. Steps: download the template → fill it in Excel → choose the file →
 * the API checks every row (preview, nothing saved) → Confirm saves. Nothing is saved while any row
 * has a problem.
 */
export function ExcelUploadButton({
  title,
  help,
  keyLabel,
  requiredColumns,
  onTemplate,
  options,
  optionsKey = '',
  run,
  onSaved,
  label = 'Upload Excel',
}: {
  title: string;
  /** What the columns mean (shown above the file picker). */
  help: ReactNode;
  /** Header of the identifying column in the preview ("SKU", "Code" …). */
  keyLabel: string;
  /** Normalised column names the file must have. */
  requiredColumns: string[];
  /** Downloads a template (often the current list, ready to edit). */
  onTemplate: () => Promise<void>;
  /** Extra choices (e.g. Replace / Add), rendered above the file picker. */
  options?: ReactNode;
  /** Changes when the options change, so an old preview is cleared. */
  optionsKey?: string;
  run: (rows: SheetRow[], dryRun: boolean) => Promise<ImportResult>;
  onSaved?: () => Promise<unknown> | void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'template' | 'check' | 'save' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setResult(null), [optionsKey]);

  const reset = () => {
    setFileName('');
    setRows(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };
  const go = async (step: 'template' | 'check' | 'save', fn: () => Promise<void>) => {
    setBusy(step);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };
  const check = (data: SheetRow[]) =>
    go('check', async () => {
      const missing = requiredColumns.filter((c) => !Object.keys(data[0] ?? {}).includes(c));
      if (missing.length)
        throw new Error(
          `Missing column: ${missing.join(', ')}. Start from the template so the column names match.`,
        );
      setResult(await run(data, true));
    });

  const saved = result && !result.dryRun;
  const canSave = result?.dryRun && result.errors === 0 && result.created + result.updated > 0;
  const shown = (result?.rows ?? []).filter((r) => r.action !== 'unchanged');

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <UploadIcon />
        {label}
      </Button>
      <Modal
        open={open}
        title={title}
        size="lg"
        onClose={() => (busy ? undefined : setOpen(false))}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy !== null}>
              {saved ? 'Done' : 'Cancel'}
            </Button>
            {saved ? null : (
              <Button
                disabled={!canSave}
                loading={busy === 'save'}
                onClick={() =>
                  go('save', async () => {
                    const r = await run(rows ?? [], false);
                    setResult(r);
                    await onSaved?.();
                  })
                }
              >
                Confirm and save
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <ol className="space-y-3">
            <Step n={1} title="Download the template">
              <Button
                variant="ghost"
                size="sm"
                loading={busy === 'template'}
                onClick={() => go('template', onTemplate)}
              >
                Download template
              </Button>
            </Step>
            <Step n={2} title="Fill it in Excel and save it">
              <div className="text-gray-600">{help}</div>
            </Step>
            <Step n={3} title="Choose the file">
              <div className="space-y-3">
                {options}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  aria-label="Excel file"
                  disabled={busy !== null || Boolean(saved)}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:font-medium hover:file:bg-gray-200"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    setResult(null);
                    setRows(null);
                    if (!f) return;
                    setFileName(f.name);
                    await go('check', async () => {
                      const data = await readSpreadsheet(f);
                      setRows(data);
                      await check(data);
                    });
                  }}
                />
                {rows && !result && busy !== 'check' ? (
                  <Button variant="outline" size="sm" onClick={() => check(rows)}>
                    Check the file again
                  </Button>
                ) : null}
              </div>
            </Step>
          </ol>

          {busy === 'check' ? <p className="text-gray-500">Checking {fileName}…</p> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}

          {result ? (
            <div className="space-y-3">
              <Alert tone={saved ? 'success' : result.errors ? 'warning' : 'info'}>
                {saved ? 'Saved: ' : 'Preview: '}
                <b>{result.created}</b> new, <b>{result.updated}</b> changed,{' '}
                <b>{result.unchanged}</b> no change
                {result.errors ? (
                  <>
                    , <b>{result.errors}</b> with problems. Fix those rows in Excel and choose the
                    file again. Nothing is saved until every row is OK.
                  </>
                ) : saved ? (
                  '.'
                ) : result.created + result.updated > 0 ? (
                  '. Press "Confirm and save" to save.'
                ) : (
                  '. There is nothing to save.'
                )}
              </Alert>
              {shown.length ? (
                <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">{keyLabel}</th>
                        <th className="px-3 py-2">Result</th>
                        <th className="px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[...shown]
                        .sort((a, b) => Number(b.action === 'error') - Number(a.action === 'error'))
                        .map((r) => (
                          <tr key={r.line} className={r.action === 'error' ? 'bg-red-50/60' : ''}>
                            <td className="px-3 py-1.5 text-gray-500">{r.line}</td>
                            <td className="max-w-[10rem] truncate px-3 py-1.5 font-mono">
                              {r.key || '—'}
                            </td>
                            <td className="px-3 py-1.5">
                              <Badge tone={TONE[r.action]}>{ACTION_LABEL[r.action]}</Badge>
                            </td>
                            <td className="px-3 py-1.5 text-gray-700">{r.message}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-gray-900">{title}</p>
        {children}
      </div>
    </li>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M10 13V3m0 0L6 7m4-4 4 4M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
