'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import {
  GATEWAY_STATUS_LABELS,
  GATEWAY_STATUS_TONES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  WEBHOOK_STATUS_TONES,
  type PaymentGatewayDto,
  type PaymentLogItem,
  type PaymentMethod,
  type PaymentStatus,
  type WebhookLogItem,
  type WebhookLogStatus,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  DataTable,
  DetailList,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Spinner,
  Tabs,
  formatDateTime,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { paymentAdminApi, queryKeys } from '@/lib/api-client';

type View = 'gateways' | 'payments' | 'webhooks';

export function PaymentsPage() {
  const [view, setView] = useState<View>('gateways');
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Payments"
        description="Online payment gateways, cash on delivery, and payment / webhook logs."
      />
      <Tabs
        className="mb-6"
        value={view}
        onChange={setView}
        items={[
          { value: 'gateways', label: 'Gateways' },
          { value: 'payments', label: 'Payment log' },
          { value: 'webhooks', label: 'Webhooks' },
        ]}
      />
      {view === 'gateways' ? <Gateways /> : view === 'payments' ? <PaymentLog /> : <WebhookLog />}
    </div>
  );
}

// ================================================================== gateways
function Gateways() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.paymentAdmin.gateways,
    queryFn: paymentAdminApi.gateways,
  });
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (isLoading || !data) return <Spinner />;
  const active = data.some((g) => g.status === 'ACTIVE');
  return (
    <div className="space-y-6">
      {!active ? (
        <Alert tone="warning">
          No online gateway is active: checkout offers cash on delivery only.
        </Alert>
      ) : null}
      {data.map((g) => (
        <GatewayCard key={`${g.code}-${g.updatedAt}`} gateway={g} />
      ))}
      <Card className="space-y-2">
        <CardTitle>Cash on delivery</CardTitle>
        <p className="text-sm text-gray-600">
          Turn COD on or off, and set its fee and maximum order value in{' '}
          <Link href="/settings" className="font-medium text-brand-700 hover:underline">
            Settings → Payments / Checkout
          </Link>
          . Allow or block COD per delivery zone and option in{' '}
          <Link href="/settings/shipping" className="font-medium text-brand-700 hover:underline">
            Settings → Shipping
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

function GatewayCard({ gateway: g }: { gateway: PaymentGatewayDto }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(g.isEnabled);
  const [testMode, setTestMode] = useState(g.isTestMode);
  const [methods, setMethods] = useState<PaymentMethod[]>(g.methods);
  const [position, setPosition] = useState(String(g.position));
  const [creds, setCreds] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      paymentAdminApi.saveGateway(g.code, {
        isEnabled: enabled,
        isTestMode: testMode,
        methods,
        position: Number(position) || 0,
        credentials: creds,
      }),
    onSuccess: async () => {
      setCreds({});
      await queryClient.invalidateQueries({ queryKey: queryKeys.paymentAdmin.gateways });
    },
  });
  const toggle = (m: PaymentMethod) =>
    setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{g.name}</CardTitle>
          <p className="mt-1 text-sm text-gray-500">{g.description}</p>
        </div>
        <Badge tone={GATEWAY_STATUS_TONES[g.status]}>{GATEWAY_STATUS_LABELS[g.status]}</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <Checkbox
            label="Enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <Checkbox
            label="Test mode"
            description="Use the gateway's sandbox keys."
            checked={testMode}
            onChange={(e) => setTestMode(e.target.checked)}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Methods at checkout</p>
            <div className="space-y-2">
              {g.availableMethods.map((m) => (
                <Checkbox
                  key={m}
                  label={PAYMENT_METHOD_LABELS[m]}
                  checked={methods.includes(m)}
                  onChange={() => toggle(m)}
                />
              ))}
            </div>
          </div>
          <Input
            label="Priority"
            type="number"
            min={0}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            hint="Checkout uses the enabled gateway with the lowest number."
          />
        </div>
        <div className="space-y-3">
          {g.fields.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              type={f.secret ? 'password' : 'text'}
              autoComplete="off"
              placeholder={f.isSet ? `${f.preview} (saved — type to replace)` : 'Not set'}
              value={creds[f.key] ?? ''}
              onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
              hint={f.hint}
            />
          ))}
          <div>
            <p className="text-sm font-medium text-gray-700">Webhook URL</p>
            <code className="mt-1 block break-all rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
              {g.webhookUrl}
            </code>
            <p className="mt-1 text-xs text-gray-500">
              Enter this in the gateway dashboard as the payment notification URL.
            </p>
          </div>
        </div>
      </div>
      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
      {save.isSuccess ? (
        <Alert tone="success">Saved. Credentials are stored encrypted.</Alert>
      ) : null}
      <div className="flex justify-end">
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Save {g.name}
        </Button>
      </div>
    </Card>
  );
}

// ================================================================== payment log
type StatusFilter = PaymentStatus | 'ALL';
const PAYMENT_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

function PaymentLog() {
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const deferred = useDeferredValue(search.trim());
  const params = {
    status: status === 'ALL' ? undefined : status,
    search: deferred || undefined,
    page,
    limit: 20,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.paymentAdmin.payments(params),
    queryFn: () => paymentAdminApi.payments(params),
    placeholderData: keepPreviousData,
  });
  const columns: DataTableColumn<PaymentLogItem>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (p) => (
        <button
          type="button"
          onClick={() => setOpenId(p.id)}
          className="text-left font-mono font-medium text-gray-900 hover:text-brand-700"
        >
          {p.orderNumber}
        </button>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      cell: (p) => `${PAYMENT_METHOD_LABELS[p.method]} · ${p.provider}`,
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (p) => (
        <div>
          {formatMoney(p.amount, p.currency)}
          {p.refunded > 0 ? (
            <p className="text-xs text-gray-500">Refunded {formatMoney(p.refunded, p.currency)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <Badge tone={PAYMENT_STATUS_TONES[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</Badge>
      ),
    },
    {
      key: 'ref',
      header: 'Gateway reference',
      cell: (p) => <code className="text-xs text-gray-500">{p.providerRef ?? '—'}</code>,
    },
    { key: 'date', header: 'Created', cell: (p) => formatDateTime(p.createdAt) },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={PAYMENT_TABS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <div className="w-full max-w-xs">
          <Input
            aria-label="Search payments"
            placeholder="Order number or reference…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(p) => p.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No payments"
            description="Payment attempts appear here (online and cash on delivery)."
          />
        }
      />
      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
      <PaymentDetailModal id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function PaymentDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: p, error } = useQuery({
    queryKey: queryKeys.paymentAdmin.payment(id ?? ''),
    queryFn: () => paymentAdminApi.payment(id as string),
    enabled: id !== null,
  });
  const money = (n: number) => formatMoney(n, p?.currency ?? 'USD');
  return (
    <Modal
      open={id !== null}
      title={p ? `Payment for ${p.orderNumber}` : 'Payment'}
      onClose={onClose}
      size="lg"
    >
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : !p ? (
        <Spinner />
      ) : (
        <div className="space-y-4 text-sm">
          <DetailList
            items={[
              {
                label: 'Order',
                value: (
                  <Link href={`/orders/${p.orderId}`} className="text-brand-700 hover:underline">
                    {p.orderNumber}
                  </Link>
                ),
              },
              { label: 'Customer', value: p.email },
              { label: 'Method', value: `${PAYMENT_METHOD_LABELS[p.method]} · ${p.provider}` },
              { label: 'Amount', value: money(p.amount) },
              { label: 'Status', value: PAYMENT_STATUS_LABELS[p.status] },
              { label: 'Gateway reference', value: p.providerRef },
              { label: 'Created', value: formatDateTime(p.createdAt) },
            ]}
          />
          <div>
            <p className="mb-1 font-medium text-gray-900">Transactions</p>
            {p.transactions.length === 0 ? (
              <p className="text-gray-500">None yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {p.transactions.map((t) => (
                  <li key={t.id} className="flex justify-between gap-3 py-1.5">
                    <span>
                      {t.type} · {t.status}
                    </span>
                    <span className="text-gray-500">
                      {money(t.amount)} · {formatDateTime(t.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1 font-medium text-gray-900">Refunds</p>
            {p.refunds.length === 0 ? (
              <p className="text-gray-500">None.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {p.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 py-1.5">
                    <span>
                      {money(r.amount)} · {PAYMENT_STATUS_LABELS[r.status]}
                      {r.reason ? ` — ${r.reason}` : ''}
                    </span>
                    <span className="text-gray-500">
                      {r.providerRef ?? ''} · {formatDateTime(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ================================================================== webhook log
type WebhookFilter = WebhookLogStatus | 'ALL';
const WEBHOOK_TABS: { value: WebhookFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PROCESSED', label: 'Processed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PENDING', label: 'Pending' },
];

function WebhookLog() {
  const [status, setStatus] = useState<WebhookFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const deferred = useDeferredValue(search.trim());
  const params = {
    status: status === 'ALL' ? undefined : status,
    search: deferred || undefined,
    page,
    limit: 20,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.paymentAdmin.webhooks(params),
    queryFn: () => paymentAdminApi.webhooks(params),
    placeholderData: keepPreviousData,
  });
  const detail = useQuery({
    queryKey: queryKeys.paymentAdmin.webhook(openId ?? ''),
    queryFn: () => paymentAdminApi.webhook(openId as string),
    enabled: openId !== null,
  });
  const columns: DataTableColumn<WebhookLogItem>[] = [
    {
      key: 'event',
      header: 'Event',
      cell: (w) => (
        <button
          type="button"
          onClick={() => setOpenId(w.id)}
          className="text-left hover:text-brand-700"
        >
          <span className="font-medium text-gray-900">{w.type}</span>
          <p className="font-mono text-xs text-gray-500">{w.eventId}</p>
        </button>
      ),
    },
    { key: 'gateway', header: 'Gateway', cell: (w) => w.provider },
    {
      key: 'status',
      header: 'Status',
      cell: (w) => (
        <div>
          <Badge tone={WEBHOOK_STATUS_TONES[w.status]}>{w.status.toLowerCase()}</Badge>
          {w.error ? (
            <p className="mt-1 max-w-xs truncate text-xs text-red-600">{w.error}</p>
          ) : null}
        </div>
      ),
    },
    { key: 'date', header: 'Received', cell: (w) => formatDateTime(w.createdAt) },
  ];
  return (
    <div className="space-y-4">
      <Alert tone="info">
        Each gateway event is applied once. Failed events are applied again when the gateway retries
        them.
      </Alert>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={WEBHOOK_TABS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <div className="w-full max-w-xs">
          <Input
            aria-label="Search webhooks"
            placeholder="Event id or type…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(w) => w.id}
        loading={isLoading}
        empty={
          <EmptyState title="No webhook events" description="Gateway notifications appear here." />
        }
      />
      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
      <Modal
        open={openId !== null}
        title={detail.data ? detail.data.type : 'Webhook event'}
        onClose={() => setOpenId(null)}
        size="lg"
      >
        {detail.error ? (
          <Alert tone="error">{detail.error.message}</Alert>
        ) : !detail.data ? (
          <Spinner />
        ) : (
          <div className="space-y-3 text-sm">
            <DetailList
              items={[
                { label: 'Event id', value: detail.data.eventId },
                { label: 'Gateway', value: detail.data.provider },
                { label: 'Received', value: formatDateTime(detail.data.createdAt) },
                {
                  label: 'Processed',
                  value: detail.data.processedAt ? formatDateTime(detail.data.processedAt) : null,
                },
                { label: 'Error', value: detail.data.error },
              ]}
            />
            <pre className="max-h-80 overflow-auto rounded bg-gray-50 p-3 text-xs">
              {JSON.stringify(detail.data.payload, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
