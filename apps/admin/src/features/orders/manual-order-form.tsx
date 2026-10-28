'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import type { StorefrontProductCard } from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  Input,
  PageHeader,
  Textarea,
  formatMoney,
} from '@ecommerce/ui';
import { storefrontApi, toolsApi } from '@/lib/api-client';

interface Line {
  variantId: string;
  label: string;
  price: number;
  currency: string;
  available: number;
  quantity: number;
}

const emptyAddress = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'PK',
};

/** Phone / WhatsApp orders: placed through the normal checkout (prices, stock, shipping, tax), cash on delivery. */
export function ManualOrderForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState(emptyAddress);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<StorefrontProductCard | null>(null);
  const [customerNote, setCustomerNote] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const q = useDeferredValue(search.trim());
  const results = useQuery({
    queryKey: ['manual-order', 'search', q],
    queryFn: () => storefrontApi.products({ q, limit: 8 }),
    enabled: q.length >= 2,
  });
  const detail = useQuery({
    queryKey: ['manual-order', 'product', picked?.slug],
    queryFn: () => storefrontApi.product(picked!.slug),
    enabled: picked !== null,
  });
  const place = useMutation({
    mutationFn: () =>
      toolsApi.manualOrder({
        email: email.trim(),
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        address: {
          ...address,
          line2: address.line2 || null,
          state: address.state || null,
          postalCode: address.postalCode || null,
        },
        customerNote: customerNote.trim() || null,
        staffNote: staffNote.trim() || null,
      }),
    onSuccess: (r) => router.push(`/orders/${r.orderId}`),
  });
  const addVariant = (v: {
    id: string;
    sku: string;
    price: number;
    available: number;
    label: string | null;
  }) => {
    if (!detail.data) return;
    setLines((cur) =>
      cur.some((l) => l.variantId === v.id)
        ? cur.map((l) => (l.variantId === v.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [
            ...cur,
            {
              variantId: v.id,
              label: `${detail.data!.name}${v.label ? ` (${v.label})` : ''} · ${v.sku}`,
              price: v.price,
              currency: detail.data!.currency,
              available: v.available,
              quantity: 1,
            },
          ],
    );
  };
  const field = (k: keyof typeof emptyAddress, label: string) => (
    <Input
      label={label}
      value={address[k]}
      onChange={(e) => setAddress((a) => ({ ...a, [k]: e.target.value }))}
    />
  );
  const ready =
    email.includes('@') &&
    lines.length > 0 &&
    address.fullName &&
    address.phone &&
    address.line1 &&
    address.city;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        breadcrumb={
          <Link href="/orders" className="hover:text-gray-700">
            ← Orders
          </Link>
        }
        title="Manual order"
        description="For orders taken by phone or chat. Cash on delivery; the customer gets the usual emails."
        actions={
          <Button disabled={!ready} loading={place.isPending} onClick={() => place.mutate()}>
            Place order
          </Button>
        }
      />
      {place.error ? <Alert tone="error">{place.error.message}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>Items</CardTitle>
          <Input
            aria-label="Search products"
            placeholder="Search products…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPicked(null);
            }}
          />
          {q.length >= 2 && !picked ? (
            <ul className="divide-y divide-gray-100 rounded border border-gray-200 text-sm">
              {(results.data?.items ?? []).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50"
                    onClick={() => setPicked(p)}
                  >
                    {p.name}{' '}
                    <span className="text-gray-500">· {formatMoney(p.price, p.currency)}</span>
                  </button>
                </li>
              ))}
              {results.data && results.data.items.length === 0 ? (
                <li className="px-3 py-2 text-gray-500">No products found</li>
              ) : null}
            </ul>
          ) : null}
          {picked && detail.data ? (
            <div className="space-y-1 rounded border border-gray-200 p-3 text-sm">
              <p className="font-medium">{detail.data.name}</p>
              {detail.data.variants.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2">
                  <span>
                    {v.label ?? 'Default'} · {v.sku} · {formatMoney(v.price, detail.data!.currency)}{' '}
                    · {v.available} in stock
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={v.available <= 0}
                    onClick={() => addVariant(v)}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <ul className="divide-y divide-gray-100 text-sm">
            {lines.map((l) => (
              <li key={l.variantId} className="flex items-center gap-2 py-2">
                <span className="flex-1">{l.label}</span>
                <input
                  type="number"
                  min={1}
                  max={l.available}
                  aria-label="Quantity"
                  value={l.quantity}
                  onChange={(e) =>
                    setLines((cur) =>
                      cur.map((x) =>
                        x.variantId === l.variantId
                          ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) }
                          : x,
                      ),
                    )
                  }
                  className="h-9 w-16 rounded border border-gray-300 px-2"
                />
                <span className="w-24 text-right">
                  {formatMoney(l.price * l.quantity, l.currency)}
                </span>
                <button
                  type="button"
                  className="text-red-600"
                  aria-label="Remove"
                  onClick={() => setLines((cur) => cur.filter((x) => x.variantId !== l.variantId))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {lines.length ? (
            <p className="text-xs text-gray-500">
              Shipping, discounts and tax are calculated when the order is placed.
            </p>
          ) : null}
        </Card>
        <div className="space-y-6">
          <Card className="space-y-3">
            <CardTitle>Customer</CardTitle>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint="Linked to their account if one exists; confirmation emails go here."
            />
            {field('fullName', 'Full name')}
            {field('phone', 'Phone')}
            {field('line1', 'Address')}
            {field('line2', 'Address line 2 (optional)')}
            <div className="grid gap-3 sm:grid-cols-2">
              {field('city', 'City')}
              {field('state', 'Province')}
              {field('postalCode', 'Postal code')}
              {field('countryCode', 'Country (2 letters)')}
            </div>
          </Card>
          <Card className="space-y-3">
            <Textarea
              label="Note from the customer"
              rows={2}
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
            />
            <Textarea
              label="Internal note"
              rows={2}
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              hint="Only staff see it."
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
