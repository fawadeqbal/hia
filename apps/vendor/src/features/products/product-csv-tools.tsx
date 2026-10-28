'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PRODUCT_CSV_COLUMNS, type ProductImportResult } from '@ecommerce/types';
import { Alert, Badge, Button, Modal, downloadCsv } from '@ecommerce/ui';
import { toolsApi } from '@/lib/api-client';

/** Export products to CSV; import a CSV to create (drafts) or update simple products by SKU. Check first, then import. */
export function ProductCsvTools() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const exportCsv = useMutation({
    mutationFn: toolsApi.vendorProductsCsv,
    onSuccess: (d) => downloadCsv(d.filename, d.rows),
  });
  const run = useMutation({
    mutationFn: (dryRun: boolean) => toolsApi.importVendorProducts({ csv, dryRun }),
    onSuccess: async (r) => {
      setResult(r);
      if (!r.dryRun) await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
  const reset = () => {
    setCsv('');
    setFileName('');
    setResult(null);
    run.reset();
  };
  const checked = result?.dryRun && result.errors === 0;

  return (
    <>
      <Button variant="outline" loading={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
        Export CSV
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Import CSV
      </Button>
      {exportCsv.error ? (
        <span className="text-sm text-red-600">{exportCsv.error.message}</span>
      ) : null}
      <Modal
        open={open}
        title="Import products"
        size="lg"
        description={`Columns: ${PRODUCT_CSV_COLUMNS.filter((c) => c !== 'status').join(', ')}. New SKUs become draft products (need name, category slug, price); existing simple products are updated, empty cells stay unchanged. Tip: export first and edit that file.`}
        onClose={() => (run.isPending ? undefined : setOpen(false))}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={run.isPending}>
              Close
            </Button>
            <Button
              variant="outline"
              disabled={!csv}
              loading={run.isPending && run.variables === true}
              onClick={() => run.mutate(true)}
            >
              Check file
            </Button>
            <Button
              disabled={!checked}
              loading={run.isPending && run.variables === false}
              onClick={() => run.mutate(false)}
            >
              Import
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            className="block text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setResult(null);
              if (!f) return;
              setFileName(f.name);
              setCsv(await f.text());
            }}
          />
          {fileName ? <p className="text-sm text-gray-500">{fileName}</p> : null}
          {run.error ? <Alert tone="error">{run.error.message}</Alert> : null}
          {result ? (
            <>
              <Alert tone={result.errors ? 'warning' : 'success'}>
                {result.dryRun ? 'Checked: ' : 'Imported: '}
                {result.created} new, {result.updated} updated, {result.errors} with problems.
                {result.dryRun && !result.errors ? ' Click Import to save.' : ''}
                {result.dryRun && result.errors ? ' Fix the rows below and check again.' : ''}
              </Alert>
              <ul className="max-h-64 divide-y divide-gray-100 overflow-auto text-sm">
                {result.rows.map((r) => (
                  <li key={r.line} className="flex gap-3 py-1.5">
                    <span className="w-14 text-gray-500">Line {r.line}</span>
                    <span className="w-32 truncate font-mono">{r.sku}</span>
                    <Badge
                      tone={r.action === 'error' ? 'red' : r.action === 'create' ? 'green' : 'blue'}
                    >
                      {r.action}
                    </Badge>
                    <span className="flex-1 text-gray-600">{r.message}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
