'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { POINTS_TYPE_LABELS, type TierDto } from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  Input,
  PageHeader,
  Spinner,
  formatDate,
} from '@ecommerce/ui';
import { loyaltyApi, queryKeys } from '@/lib/api-client';

export function LoyaltyAdmin() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        title="Loyalty"
        description="Earning and redemption rules are settings (loyalty.*) in the Setting table. Tiers follow lifetime points."
        actions={
          <Link href="/loyalty/activity">
            <Button variant="outline">Rewards activity</Button>
          </Link>
        }
      />
      <Tiers />
      <Member />
    </div>
  );
}

function Tiers() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: queryKeys.loyalty.tiers,
    queryFn: loyaltyApi.tiers,
  });
  const save = useMutation({
    mutationFn: (t: TierDto) =>
      loyaltyApi.updateTier(t.id, { minPoints: t.minPoints, multiplier: t.multiplier }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.tiers }),
  });
  const [edits, setEdits] = useState<Record<string, TierDto>>({});
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (!data) return <Spinner />;
  return (
    <Card className="space-y-3">
      <CardTitle>Tiers</CardTitle>
      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
      {data.map((t) => {
        const e = edits[t.id] ?? t;
        return (
          <div key={t.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3">
            <p className="pb-2 font-medium text-gray-900">{t.name}</p>
            <Input
              label="From lifetime points"
              type="number"
              value={e.minPoints}
              onChange={(ev) =>
                setEdits((s) => ({ ...s, [t.id]: { ...e, minPoints: Number(ev.target.value) } }))
              }
            />
            <Input
              label="Points multiplier"
              type="number"
              step="0.05"
              value={e.multiplier}
              onChange={(ev) =>
                setEdits((s) => ({ ...s, [t.id]: { ...e, multiplier: Number(ev.target.value) } }))
              }
            />
            <Button
              variant="outline"
              loading={save.isPending && save.variables?.id === t.id}
              onClick={() => save.mutate(e)}
            >
              Save
            </Button>
          </div>
        );
      })}
    </Card>
  );
}

function Member() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const member = useQuery({
    queryKey: queryKeys.loyalty.member(lookup),
    queryFn: () => loyaltyApi.member(lookup),
    enabled: lookup.length > 3,
    retry: false,
  });
  const adjust = useMutation({
    mutationFn: () =>
      loyaltyApi.adjustPoints(member.data!.userId, { points: Number(points), reason }),
    onSuccess: (m) => {
      queryClient.setQueryData(queryKeys.loyalty.member(lookup), m);
      setPoints('');
      setReason('');
    },
  });
  const m = member.data;
  return (
    <Card className="space-y-4">
      <CardTitle>Customer points</CardTitle>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setLookup(email.trim());
        }}
      >
        <Input
          aria-label="Customer email"
          placeholder="customer@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Find
        </Button>
      </form>
      {member.error ? <Alert tone="error">{member.error.message}</Alert> : null}
      {m ? (
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-medium text-gray-900">{m.name}</span> · {m.email} ·{' '}
            <b>{m.points}</b> points · lifetime {m.lifetimePoints} · {m.tier ?? 'no tier'}
          </p>
          <div className="grid grid-cols-[120px_1fr_auto] items-end gap-2">
            <Input
              label="± points"
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
            <Input
              label="Reason (in the customer's history)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              loading={adjust.isPending}
              disabled={!Number(points) || reason.trim().length < 3}
              onClick={() => adjust.mutate()}
            >
              Adjust
            </Button>
          </div>
          {adjust.error ? <Alert tone="error">{adjust.error.message}</Alert> : null}
          <ul className="divide-y divide-gray-100">
            {m.history.map((t) => (
              <li key={t.id} className="flex justify-between py-1.5">
                <span>
                  {t.description ?? POINTS_TYPE_LABELS[t.type]}{' '}
                  <span className="text-xs text-gray-500">· {formatDate(t.createdAt)}</span>
                </span>
                <span className={t.points >= 0 ? 'text-green-700' : 'text-gray-700'}>
                  {t.points >= 0 ? '+' : ''}
                  {t.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
