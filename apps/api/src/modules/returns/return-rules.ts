import type { ReturnAction, ReturnStatus } from '@ecommerce/types';

/** Who moves a return where. Customer: REQUESTED → CLOSED (withdraw). */
export const RETURN_TRANSITIONS: Record<ReturnAction, { from: ReturnStatus; to: ReturnStatus }> = {
  approve: { from: 'REQUESTED', to: 'APPROVED' },
  reject: { from: 'REQUESTED', to: 'REJECTED' },
  receive: { from: 'APPROVED', to: 'ITEMS_RECEIVED' },
  refund: { from: 'ITEMS_RECEIVED', to: 'REFUNDED' },
};

export function nextActions(status: ReturnStatus): ReturnAction[] {
  return (Object.keys(RETURN_TRANSITIONS) as ReturnAction[]).filter(
    (a) => RETURN_TRANSITIONS[a].from === status,
  );
}

/** Statuses that still "hold" the returned units (others free them for a new request). */
export const OPEN_RETURN_STATUSES: ReturnStatus[] = [
  'REQUESTED',
  'APPROVED',
  'ITEMS_RECEIVED',
  'REFUNDED',
];

/** Last moment to request a return: delivery + window days. null = not delivered / returns off. */
export function returnDeadline(
  deliveredAt: Date | null | undefined,
  windowDays: number,
): Date | null {
  if (!deliveredAt || windowDays <= 0) return null;
  return new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
}

/** Units still returnable on a line: bought − already in open returns. */
export function returnableQuantity(bought: number, alreadyReturned: number): number {
  return Math.max(0, bought - alreadyReturned);
}

/** "RMA-261011-7K2QX" */
export function generateRmaNumber(now = new Date(), random = Math.random): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const suffix = Array.from(
    { length: 5 },
    () => alphabet[Math.floor(random() * alphabet.length)],
  ).join('');
  return `RMA-${date}-${suffix}`;
}
