'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardTitle, formatDateTime } from '@ecommerce/ui';
import type { OrderDto } from '@ecommerce/types';
import { documentsApi, queryKeys } from '@/lib/api-client';

export const orderActionClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] px-4 text-sm font-bold transition-colors disabled:opacity-50';

/** Invoice PDF link for the order header (hidden until the order is paid / confirmed). */
export function InvoiceLink({ order }: { order: OrderDto }) {
  if (order.status === 'PENDING_PAYMENT' || order.status === 'CANCELLED') return null;
  return (
    <a
      href={documentsApi.customerInvoiceUrl(order.orderNumber)}
      target="_blank"
      rel="noreferrer"
      className={`${orderActionClass} bg-brand-100 text-brand-700 hover:bg-brand-200 hover:text-brand-800`}
    >
      Download invoice
    </a>
  );
}

/** Signed-in customer: messages from the store / sellers about this order. */
export function OrderDocuments({ order }: { order: OrderDto }) {
  const { data: notes } = useQuery({
    queryKey: queryKeys.orderNotes('customer', order.orderNumber),
    queryFn: () => documentsApi.customerNotes(order.orderNumber),
  });
  return (
    <>
      {notes?.length ? (
        <Card className="space-y-3 rounded-3xl border-0 p-5 text-sm shadow-none">
          <CardTitle>Messages about your order</CardTitle>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id}>
                <p className="text-xs text-gray-500">
                  {n.from} · {formatDateTime(n.createdAt)}
                </p>
                <p className="whitespace-pre-line text-gray-800">{n.content}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
