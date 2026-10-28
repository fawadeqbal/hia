'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { VENDOR_REASON_MIN, type VendorAdminDto } from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  DetailList,
  Input,
  PageHeader,
  Spinner,
  Textarea,
  formatDate,
  formatDateTime,
} from '@ecommerce/ui';
import { BrandLogo } from '@/features/brands/brand-logo';
import { commissionsApi, queryKeys, vendorsApi } from '@/lib/api-client';
import { VendorStatusBadge } from './vendor-status-badge';

type Action = 'approve' | 'reject' | 'suspend' | 'reactivate';

const ACTION_COPY: Record<
  Action,
  { title: string; confirm: string; tone: 'primary' | 'danger'; needsReason: boolean }
> = {
  approve: {
    title: 'Approve this store?',
    confirm: 'Approve',
    tone: 'primary',
    needsReason: false,
  },
  reject: {
    title: 'Reject this application?',
    confirm: 'Reject',
    tone: 'danger',
    needsReason: true,
  },
  suspend: { title: 'Suspend this store?', confirm: 'Suspend', tone: 'danger', needsReason: true },
  reactivate: {
    title: 'Reactivate this store?',
    confirm: 'Reactivate',
    tone: 'primary',
    needsReason: false,
  },
};

export function VendorDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const {
    data: vendor,
    error,
    isLoading,
  } = useQuery({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: () => vendorsApi.adminGet(id),
  });

  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [approveCommission, setApproveCommission] = useState('');

  const onSaved = async (updated: VendorAdminDto) => {
    queryClient.setQueryData(queryKeys.vendors.detail(id), updated);
    await queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.commissions.all });
  };

  const decide = useMutation({
    mutationFn: (kind: Action) => {
      const run: Record<Action, () => Promise<VendorAdminDto>> = {
        approve: () =>
          vendorsApi.approve(
            id,
            approveCommission === '' ? {} : { commissionRate: Number(approveCommission) },
          ),
        reject: () => vendorsApi.reject(id, { reason: reason.trim() }),
        suspend: () => vendorsApi.suspend(id, { reason: reason.trim() }),
        reactivate: () => vendorsApi.reactivate(id),
      };
      return run[kind]();
    },
    onSuccess: async (updated) => {
      await onSaved(updated);
      setAction(null);
    },
  });

  const open = (kind: Action) => {
    decide.reset();
    setReason('');
    setApproveCommission('');
    setAction(kind);
  };

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert tone="error" title="Could not load the vendor">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (isLoading || !vendor) return <Spinner className="p-6" />;

  const copy = action ? ACTION_COPY[action] : null;
  const reasonTooShort = copy?.needsReason === true && reason.trim().length < VENDOR_REASON_MIN;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/vendors" className="hover:text-gray-700">
            ← Vendors
          </Link>
        }
        title={vendor.name}
        description={`Applied ${formatDate(vendor.createdAt)}${vendor.approvedAt ? ` · approved ${formatDate(vendor.approvedAt)}` : ''}`}
        actions={
          <>
            {vendor.status === 'PENDING' || vendor.status === 'REJECTED' ? (
              <Button onClick={() => open('approve')}>Approve</Button>
            ) : null}
            {vendor.status === 'PENDING' ? (
              <Button variant="danger" onClick={() => open('reject')}>
                Reject
              </Button>
            ) : null}
            {vendor.status === 'APPROVED' ? (
              <Button variant="danger" onClick={() => open('suspend')}>
                Suspend
              </Button>
            ) : null}
            {vendor.status === 'SUSPENDED' ? (
              <Button onClick={() => open('reactivate')}>Reactivate</Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <VendorStatusBadge status={vendor.status} />
        {vendor.statusReason ? (
          <span className="text-sm text-gray-600">Reason: {vendor.statusReason}</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4">
            {vendor.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.bannerUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
            ) : null}
            <div className="flex items-center gap-4">
              <BrandLogo name={vendor.name} url={vendor.logoUrl} size={56} />
              <div>
                <CardTitle>{vendor.name}</CardTitle>
                <p className="text-sm text-gray-500">/stores/{vendor.slug}</p>
              </div>
            </div>
            <DetailList
              items={[
                { label: 'Store email', value: vendor.email },
                { label: 'Phone', value: vendor.phone },
                { label: 'Description', value: vendor.description },
                { label: 'Shipping policy', value: vendor.policies?.shipping },
                { label: 'Return policy', value: vendor.policies?.returns },
              ]}
            />
          </Card>

          <Card>
            <CardTitle className="mb-2">Payout details</CardTitle>
            <DetailList
              items={[
                { label: 'Account holder', value: vendor.payout.bankAccountName },
                { label: 'Bank', value: vendor.payout.bankName },
                { label: 'Account number', value: vendor.payout.bankAccountNumber },
                { label: 'IBAN', value: vendor.payout.iban },
              ]}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle className="mb-2">Owner</CardTitle>
            <DetailList
              items={[
                { label: 'Name', value: `${vendor.owner.firstName} ${vendor.owner.lastName}` },
                { label: 'Email', value: vendor.owner.email },
              ]}
            />
          </Card>

          <Card>
            <CardTitle className="mb-2">Activity</CardTitle>
            <DetailList
              items={[
                { label: 'Products', value: vendor.productCount },
                { label: 'Orders', value: vendor.orderCount },
                {
                  label: 'Rating',
                  value: vendor.ratingAverage ? vendor.ratingAverage.toFixed(2) : null,
                },
                { label: 'Last update', value: formatDateTime(vendor.updatedAt) },
              ]}
            />
          </Card>

          <CommissionCard vendor={vendor} onSaved={onSaved} />
        </div>
      </div>

      <ConfirmDialog
        open={action !== null}
        title={copy?.title ?? ''}
        tone={copy?.tone}
        confirmLabel={copy?.confirm}
        loading={decide.isPending}
        error={decide.error?.message}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (action && !reasonTooShort) decide.mutate(action);
        }}
        description={
          <div className="space-y-3">
            <p>The vendor will be notified by email.</p>
            {copy?.needsReason ? (
              <Textarea
                label="Reason (shown to the vendor)"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                hint={`At least ${VENDOR_REASON_MIN} characters.`}
                error={
                  reason.length > 0 && reasonTooShort ? 'Please explain a little more.' : undefined
                }
              />
            ) : null}
            {action === 'approve' ? (
              <Input
                label="Commission % (optional)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="Use the marketplace rules"
                value={approveCommission}
                onChange={(e) => setApproveCommission(e.target.value)}
                hint="Creates this seller's commission rule. Leave empty to use category / marketplace rules."
              />
            ) : null}
          </div>
        }
      />
    </div>
  );
}

function CommissionCard({
  vendor,
  onSaved,
}: {
  vendor: VendorAdminDto;
  onSaved: (v: VendorAdminDto) => Promise<void>;
}) {
  const [value, setValue] = useState(
    vendor.commissionRate === null ? '' : String(vendor.commissionRate),
  );
  const save = useMutation({
    mutationFn: () =>
      vendorsApi.adminUpdate(vendor.id, { commissionRate: value === '' ? null : Number(value) }),
    onSuccess: onSaved,
  });
  const invalid =
    value !== '' && (Number.isNaN(Number(value)) || Number(value) < 0 || Number(value) > 100);
  const effective = useQuery({
    queryKey: queryKeys.commissions.preview({ vendorId: vendor.id }),
    queryFn: () => commissionsApi.preview({ vendorId: vendor.id }),
  });

  return (
    <Card className="space-y-3">
      <CardTitle>Commission</CardTitle>
      {effective.data ? (
        <p className="text-sm text-gray-600">
          Charged now: <span className="font-semibold text-gray-900">{effective.data.rate}%</span>{' '}
          <span className="text-gray-500">({effective.data.label})</span>
        </p>
      ) : null}
      <Input
        label="Seller rate %"
        type="number"
        min={0}
        max={100}
        step="0.01"
        placeholder="No seller rule"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hint="Saved as this seller's commission rule. Leave empty to use category / marketplace rules."
        error={invalid ? 'Enter a value between 0 and 100' : undefined}
      />
      <Link href="/vendors/commissions" className="block text-xs text-brand-700 hover:underline">
        Category-specific rates → Commissions
      </Link>
      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
      {save.isSuccess ? <Alert tone="success">Saved</Alert> : null}
      <Button
        variant="outline"
        size="sm"
        loading={save.isPending}
        disabled={invalid}
        onClick={() => save.mutate()}
      >
        Save commission
      </Button>
    </Card>
  );
}
