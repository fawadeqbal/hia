'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  emptyIssueGiftCardForm,
  issueGiftCardSchema,
  issueGiftCardToInput,
  type GiftCardDto,
  type IssueGiftCardFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Textarea,
  formatDate,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { loyaltyApi, queryKeys } from '@/lib/api-client';

export function GiftCards() {
  const [issuing, setIssuing] = useState(false);
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.loyalty.giftCards,
    queryFn: loyaltyApi.giftCards,
  });
  const columns: DataTableColumn<GiftCardDto>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (c) => (
        <Link
          href={`/promotions/gift-cards/${c.id}`}
          className="font-mono font-semibold text-gray-900 hover:text-brand-700"
        >
          {c.code}
        </Link>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      cell: (c) =>
        `${formatMoney(c.balance, c.currency)} of ${formatMoney(c.initialBalance, c.currency)}`,
    },
    { key: 'to', header: 'Recipient', cell: (c) => c.recipientEmail ?? '—' },
    {
      key: 'expires',
      header: 'Expires',
      cell: (c) => (c.expiresAt ? formatDate(c.expiresAt) : 'Never'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => (
        <Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Disabled'}</Badge>
      ),
    },
  ];
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Gift cards"
        description="Customers enter the code at checkout; the balance pays part or all of the order and comes back if the order is cancelled."
        actions={<Button onClick={() => setIssuing(true)}>Issue gift card</Button>}
      />
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(c) => c.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No gift cards yet"
            description="Issue one to email a code to a customer."
          />
        }
      />
      {issuing ? <IssueModal onClose={() => setIssuing(false)} /> : null}
    </div>
  );
}

function IssueModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<GiftCardDto | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IssueGiftCardFormValues>({
    resolver: zodResolver(issueGiftCardSchema),
    defaultValues: emptyIssueGiftCardForm,
  });
  const issue = useMutation({
    mutationFn: (v: IssueGiftCardFormValues) => loyaltyApi.issueGiftCard(issueGiftCardToInput(v)),
    onSuccess: async (card) => {
      setIssued(card);
      await queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.giftCards });
    },
  });
  return (
    <Modal
      open
      title="Issue gift card"
      onClose={onClose}
      footer={
        issued ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="issue-form" loading={issue.isPending}>
              Issue
            </Button>
          </>
        )
      }
    >
      {issued ? (
        <Alert tone="success" title={`Code ${issued.code}`}>
          {formatMoney(issued.balance, issued.currency)}
          {issued.recipientEmail
            ? ` — emailed to ${issued.recipientEmail}`
            : ' — give this code to the customer'}
        </Alert>
      ) : (
        <form
          id="issue-form"
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((v) => issue.mutate(v))}
        >
          {issue.error ? <Alert tone="error">{issue.error.message}</Alert> : null}
          <Input
            label="Amount"
            type="number"
            step="0.01"
            {...register('amount', { valueAsNumber: true })}
            error={errors.amount?.message}
          />
          <Input
            label="Recipient email (optional — the code is emailed)"
            type="email"
            {...register('recipientEmail')}
            error={errors.recipientEmail?.message}
          />
          <Input label="From (optional)" {...register('senderName')} />
          <Textarea
            label="Message (optional)"
            rows={2}
            {...register('message')}
            error={errors.message?.message}
          />
          <Input label="Expires (optional)" type="datetime-local" {...register('expiresAt')} />
        </form>
      )}
    </Modal>
  );
}
