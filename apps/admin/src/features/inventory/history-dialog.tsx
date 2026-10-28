'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { MOVEMENT_TYPE_LABELS, type StockRow } from '@ecommerce/types';
import { Alert, Modal, Pagination, Spinner, formatDateTime } from '@ecommerce/ui';
import { inventoryApi, queryKeys } from '@/lib/api-client';

export function HistoryDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const params = { variantId: row.variantId, warehouseId: row.warehouseId, page, limit: 15 };
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.inventory.movements(params),
    queryFn: () => inventoryApi.movements(params),
    placeholderData: keepPreviousData,
  });

  return (
    <Modal
      open
      size="lg"
      title="Stock history"
      description={`${row.productName}${row.variantName ? ` · ${row.variantName}` : ''} · ${row.sku}`}
      onClose={onClose}
    >
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {isLoading ? <Spinner /> : null}
      {data && data.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No stock changes yet.</p>
      ) : null}
      {data && data.items.length > 0 ? (
        <>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Reason</th>
                <th className="py-2 pr-3 text-right">Change</th>
                <th className="py-2">Note / by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-3 text-gray-600">{formatDateTime(m.createdAt)}</td>
                  <td className="py-2 pr-3">{MOVEMENT_TYPE_LABELS[m.type]}</td>
                  <td
                    className={`py-2 pr-3 text-right font-semibold ${m.quantity >= 0 ? 'text-green-700' : 'text-red-600'}`}
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="py-2 text-gray-600">
                    {m.note ?? m.reference ?? '—'}
                    {m.createdBy ? (
                      <span className="block text-xs text-gray-400">{m.createdBy}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </Modal>
  );
}
