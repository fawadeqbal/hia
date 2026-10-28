'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useEffect, useState } from 'react';
import type { StockFilter, StockRow } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Tabs,
  buttonStyles,
  type DataTableColumn,
} from '@ecommerce/ui';
import { ProductThumb } from '@/features/products/product-thumb';
import { inventoryApi, queryKeys } from '@/lib/api-client';
import { AdjustDialog } from './adjust-dialog';
import { HistoryDialog } from './history-dialog';
import { StockStatusBadge } from './stock-status-badge';

const FILTERS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
];

export function InventoryPage() {
  const warehouses = useQuery({
    queryKey: queryKeys.inventory.warehouses,
    queryFn: inventoryApi.warehouses,
  });
  const active = (warehouses.data ?? []).filter((w) => w.isActive);

  const [warehouseId, setWarehouseId] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [history, setHistory] = useState<StockRow | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    if (!warehouseId && active[0]) setWarehouseId(active[0].id);
  }, [active, warehouseId]);

  const params = { warehouseId, filter, search: deferredSearch || undefined, page, limit: 25 };
  const stock = useQuery({
    queryKey: queryKeys.inventory.stock(params),
    queryFn: () => inventoryApi.stock(params),
    enabled: Boolean(warehouseId),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<StockRow>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <ProductThumb url={r.imageUrl} size={36} />
          <div>
            <Link
              href={`/products/${r.productId}`}
              className="font-medium text-gray-900 hover:text-brand-700"
            >
              {r.productName}
            </Link>
            <p className="text-xs text-gray-500">
              {r.variantName ?? 'Default'} · <code>{r.sku}</code>
              {!r.isActive ? (
                <Badge tone="gray" className="ml-2">
                  Inactive
                </Badge>
              ) : null}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'onHand', header: 'On hand', align: 'right', cell: (r) => r.quantity },
    { key: 'reserved', header: 'Reserved', align: 'right', cell: (r) => r.reserved },
    {
      key: 'available',
      header: 'Available',
      align: 'right',
      cell: (r) => <span className="font-semibold">{r.available}</span>,
    },
    { key: 'status', header: 'Status', cell: (r) => <StockStatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" onClick={() => setAdjusting(r)}>
            Adjust
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setHistory(r)}>
            History
          </Button>
        </div>
      ),
    },
  ];

  const error = warehouses.error ?? stock.error;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Inventory"
        description="Stock per variant. Every change is recorded with a reason."
        actions={
          <Link href="/inventory/warehouses" className={buttonStyles({ variant: 'outline' })}>
            Warehouses
          </Link>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load inventory" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {active.length > 1 ? (
            <div className="w-56">
              <Select
                label="Warehouse"
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setPage(1);
                }}
                options={active.map((w) => ({ value: w.id, label: w.name }))}
              />
            </div>
          ) : null}
          <Tabs
            items={FILTERS}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full max-w-xs">
          <Input
            aria-label="Search inventory"
            placeholder="Search product, variant or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div
        className={
          stock.isFetching && !stock.isLoading ? 'opacity-60 transition-opacity' : undefined
        }
      >
        <DataTable
          columns={columns}
          rows={stock.data?.items}
          rowKey={(r) => r.variantId}
          loading={stock.isLoading || warehouses.isLoading}
          empty={
            <EmptyState
              title={filter === 'all' && !deferredSearch ? 'No products yet' : 'Nothing matches'}
              description={
                filter === 'all' && !deferredSearch
                  ? 'Add products first; their variants appear here.'
                  : filter === 'low'
                    ? 'No variants are running low.'
                    : 'Try another filter or search.'
              }
            />
          }
        />
      </div>
      {stock.data ? (
        <Pagination
          page={stock.data.meta.page}
          totalPages={stock.data.meta.totalPages}
          total={stock.data.meta.total}
          onPageChange={setPage}
        />
      ) : null}

      {adjusting ? (
        <AdjustDialog
          key={adjusting.variantId}
          row={adjusting}
          onClose={() => setAdjusting(null)}
        />
      ) : null}
      {history ? (
        <HistoryDialog key={history.variantId} row={history} onClose={() => setHistory(null)} />
      ) : null}
    </div>
  );
}
