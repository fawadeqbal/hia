'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { POINTS_TYPE_LABELS } from '@ecommerce/types';
import { Alert, Spinner, cn, formatDate, formatMoney } from '@ecommerce/ui';
import { loyaltyApi, queryKeys } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export function LoyaltyView() {
  const { data: s, error } = useQuery({
    queryKey: queryKeys.loyalty.summary,
    queryFn: loyaltyApi.summary,
  });
  const [copied, setCopied] = useState(false);
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (!s) return <Spinner />;
  const copy = async () => {
    await navigator.clipboard?.writeText(s.referralUrl).catch(() => undefined);
    setCopied(true);
    toast.success('Invite link copied', { description: 'Share it with friends to earn points.' });
  };
  const progress =
    s.nextTier && s.tier
      ? Math.round(
          (Math.max(0, s.lifetimePoints - s.tier.minPoints) /
            Math.max(1, s.lifetimePoints - s.tier.minPoints + s.nextTier.pointsNeeded)) *
            100,
        )
      : s.nextTier
        ? Math.round((s.lifetimePoints / (s.lifetimePoints + s.nextTier.pointsNeeded)) * 100)
        : 100;

  return (
    <>
      <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading">
        Points &amp; rewards
      </h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
        <div className="flex flex-col gap-2 rounded-[12px] bg-gray-900 p-6 text-white">
          <span className="text-sm text-gray-300">Available balance</span>
          <span className="text-[52px] font-extrabold leading-none tracking-display">
            {s.points.toLocaleString()}
          </span>
          <span className="text-sm text-gray-300">
            = {formatMoney(s.value, s.currency)} at checkout
          </span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[12px] bg-white p-6">
          <div className="flex justify-between font-bold">
            <span>{s.tier?.name ?? 'Member'}</span>
            <span className="text-gray-500">{s.nextTier?.name ?? 'Top tier'}</span>
          </div>
          <div className="h-3 rounded-md bg-gray-50">
            <div className="h-full rounded-md bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm text-gray-600">
            {s.nextTier ? (
              <>
                Earn <b>{s.nextTier.pointsNeeded.toLocaleString()} more points</b> to reach{' '}
                {s.nextTier.name}.
              </>
            ) : (
              'You’re at the top tier.'
            )}
            {s.tier && s.tier.multiplier !== 1 ? ` ${s.tier.multiplier}× points on purchases.` : ''}
          </span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[12px] bg-brand-100 p-6">
          <b className="text-[17px]">Invite friends, get {s.rules.referralPoints} each</b>
          <div className="flex h-[46px] items-center overflow-hidden rounded-[8px] border-[1.5px] border-dashed border-brand-400 px-3.5 text-sm font-semibold">
            <span className="truncate">{s.referralUrl}</span>
          </div>
          <button
            type="button"
            onClick={copy}
            className="h-11 rounded-[8px] bg-brand-600 font-bold text-white hover:bg-brand-700"
          >
            {copied ? 'Link copied ✓' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white px-5 py-4 text-sm text-gray-600">
        <b className="mb-2 block text-[17px] text-gray-900">How it works</b>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Earn {s.rules.pointsPerCurrencyUnit} point per {formatMoney(1, s.currency)} paid, once
            your order is delivered.
          </li>
          <li>
            {s.rules.signupBonus} points for joining, {s.rules.reviewPoints} for each product
            review.
          </li>
          <li>
            Each point is worth {formatMoney(s.rules.pointValue, s.currency)}; use them at checkout
            for up to {s.rules.maxRedeemPercent}% of an order.
          </li>
          <li>Points expire {s.rules.expiryDays} days after you earn them.</li>
        </ul>
      </div>

      <div className="rounded-3xl bg-white px-[18px] py-2">
        {s.history.length === 0 ? (
          <p className="py-3 text-sm text-gray-500">No points yet.</p>
        ) : null}
        {s.history.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0"
          >
            <div>
              <p className="font-semibold">{t.description ?? POINTS_TYPE_LABELS[t.type]}</p>
              <p className="text-[13px] text-gray-500">
                {formatDate(t.createdAt)}
                {t.orderNumber ? ` · #${t.orderNumber}` : ''}
                {t.type === 'EARN' && t.expiresAt ? ` · expires ${formatDate(t.expiresAt)}` : ''}
              </p>
            </div>
            <b className={cn(t.points >= 0 ? 'text-emerald-700' : 'text-gray-600')}>
              {t.points >= 0 ? '+' : ''}
              {t.points.toLocaleString()}
            </b>
          </div>
        ))}
      </div>
    </>
  );
}
