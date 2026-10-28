'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  DetailList,
  Input,
  PageHeader,
  Spinner,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { loyaltyApi, queryKeys } from '@/lib/api-client';

export function GiftCardDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const key = queryKeys.loyalty.giftCard(id);
  const { data: c, error } = useQuery({ queryKey: key, queryFn: () => loyaltyApi.giftCard(id) });
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const onDone = async (card: Awaited<ReturnType<typeof loyaltyApi.giftCard>>) => {
    queryClient.setQueryData(key, card);
    await queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.giftCards });
  };
  const adjust = useMutation({
    mutationFn: () => loyaltyApi.adjustGiftCard(id, { amount: Number(amount), note }),
    onSuccess: async (card) => {
      await onDone(card);
      setAmount('');
      setNote('');
    },
  });
  const toggle = useMutation({
    mutationFn: () => loyaltyApi.setGiftCardActive(id, !c!.isActive),
    onSuccess: onDone,
  });
  if (error)
    return (
      <Alert tone="error" className="m-6">
        {error.message}
      </Alert>
    );
  if (!c) return <Spinner className="p-6" />;
  const money = (n: number) => formatMoney(n, c.currency);
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        breadcrumb={
          <Link href="/promotions/gift-cards" className="hover:text-gray-700">
            ← Gift cards
          </Link>
        }
        title={c.code}
        actions={
          <Button variant="outline" loading={toggle.isPending} onClick={() => toggle.mutate()}>
            {c.isActive ? 'Disable' : 'Enable'}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <DetailList
            items={[
              {
                label: 'Balance',
                value: <span className="font-semibold">{money(c.balance)}</span>,
              },
              { label: 'Issued', value: money(c.initialBalance) },
              {
                label: 'Status',
                value: (
                  <Badge tone={c.isActive ? 'green' : 'gray'}>
                    {c.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                ),
              },
              { label: 'Recipient', value: c.recipientEmail },
              { label: 'From', value: c.senderName },
              { label: 'Expires', value: c.expiresAt ? formatDate(c.expiresAt) : 'Never' },
            ]}
          />
        </Card>
        <Card className="space-y-3">
          <CardTitle>Adjust balance</CardTitle>
          {adjust.error ? <Alert tone="error">{adjust.error.message}</Alert> : null}
          <Input
            label="± amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            loading={adjust.isPending}
            disabled={!Number(amount) || note.trim().length < 3}
            onClick={() => adjust.mutate()}
          >
            Apply
          </Button>
        </Card>
      </div>
      <Card className="p-0">
        <div className="border-b border-gray-100 px-5 py-3 font-semibold text-gray-900">
          Transactions
        </div>
        <ul className="divide-y divide-gray-100 text-sm">
          {c.transactions.map((t) => (
            <li key={t.id} className="flex justify-between px-5 py-2">
              <span>
                {t.type}
                {t.orderNumber ? ` · ${t.orderNumber}` : ''}{' '}
                <span className="text-xs text-gray-500">· {formatDateTime(t.createdAt)}</span>
              </span>
              <span className={t.amount >= 0 ? 'text-green-700' : 'text-gray-700'}>
                {t.amount >= 0 ? '+' : ''}
                {money(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
