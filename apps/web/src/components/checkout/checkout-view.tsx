'use client';

/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  checkoutFormSchema,
  isOnlinePayment,
  checkoutFormToInput,
  emptyCheckoutForm,
  formatAddress,
  type CheckoutFormValues,
} from '@ecommerce/types';
import { Alert, Button, Checkbox, Input, Spinner, Textarea, cn, formatMoney } from '@ecommerce/ui';
import { AddressInputs } from '@/components/account/address-inputs';
import { useCart, useMe } from '@/hooks/use-cart';
import { addressesApi, checkoutApi, queryKeys } from '@/lib/api-client';
import { useLocale } from '@/components/locale/locale-provider';
import { container } from '@/components/layout/container';
import { PlacingOverlay } from './placing-overlay';
import { Panel, RadioDot, SummaryRow, codeInput, darkButton, optionCard } from './ui';

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutView() {
  const { t, currency: displayCurrency } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: cart, isLoading: cartLoading, error: cartError } = useCart();
  const me = useMe();
  const signedIn = Boolean(me.data);
  // One key per checkout visit: a double click or a retry after a timeout never creates two orders.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [placed, setPlaced] = useState(false);

  const addresses = useQuery({
    queryKey: queryKeys.addresses,
    queryFn: addressesApi.list,
    enabled: signedIn,
  });

  // The quote is re-fetched whenever the cart contents or prices change.
  const signature = cart
    ? cart.groups
        .flatMap((g) => g.items.map((i) => `${i.id}:${i.quantity}:${i.unitPrice}`))
        .join('|')
    : '';
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: emptyCheckoutForm(true),
  });

  // Once we know who is checking out, switch guest/customer mode and pick the default address.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || me.isPending) return;
    if (!signedIn) {
      initialised.current = true;
      setValue('isGuest', true);
      return;
    }
    if (addresses.isPending) return;
    initialised.current = true;
    const list = addresses.data ?? [];
    const preferred = list.find((a) => a.isDefault) ?? list[0];
    setValue('isGuest', false);
    setValue('addressId', preferred?.id ?? '');
  }, [me.isPending, signedIn, addresses.isPending, addresses.data, setValue]);

  const addressId = watch('addressId');
  const paymentMethod = watch('paymentMethod');
  // Delivery choice per seller ({ vendorId: rateId }); the API falls back to the cheapest option.
  const [shippingRateIds, setShippingRateIds] = useState<Record<string, string>>({});
  // Coupon: what the customer typed vs the code sent to the API.
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [giftInput, setGiftInput] = useState('');
  // Checkout is a 4-step flow: address → delivery → payment → review (savings, note).
  const [step, setStep] = useState(0);
  // Steps the customer tried to leave (or submit) while incomplete: shown in red.
  const [flagged, setFlagged] = useState<number[]>([]);
  // Furthest step the customer has reached with Continue: earlier steps count as confirmed.
  // (A pre-filled default address or payment method is not "done" until they've seen it.)
  const [reached, setReached] = useState(0);
  const flag = (i: number) => setFlagged((f) => (f.includes(i) ? f : [...f, i]));
  useEffect(() => {
    const fromCart = new URLSearchParams(window.location.search).get('coupon');
    if (fromCart) {
      setCouponInput(fromCart);
      setCouponCode(fromCart);
    }
  }, []);
  const [giftCardCode, setGiftCardCode] = useState<string | null>(null);
  const guestEmail = useDeferredValue(watch('email'));
  // Where the parcel goes decides the shipping zone: saved address, or the typed one (debounced).
  const [countryCode, state, city] = watch(['countryCode', 'state', 'city']);
  const typedDestination = useDeferredValue(
    countryCode.trim().length === 2 ? { countryCode: countryCode.trim(), state, city } : undefined,
  );
  const shippingInput = {
    ...(addressId ? { addressId } : { destination: typedDestination }),
    shippingRateIds,
    couponCode,
    redeemPoints,
    giftCardCode,
    email: guestEmail.includes('@') ? guestEmail.trim() : undefined,
  };

  // Totals depend on the payment method (COD adds its fee), so the method is part of the quote.
  const quote = useQuery({
    queryKey: queryKeys.checkoutQuote(
      `${signature}#${paymentMethod}#${JSON.stringify(shippingInput)}`,
    ),
    queryFn: () => checkoutApi.quote({ paymentMethod, ...shippingInput }),
    enabled: Boolean(cart && cart.itemCount > 0) && !placed,
    placeholderData: keepPreviousData,
  });

  // The API picks a method when the chosen one is unavailable (e.g. COD above its limit).
  // Only trust a fresh quote: while the new one loads, the previous (placeholder) quote still
  // carries the OLD method and would undo the customer's click.
  const selected = quote.isPlaceholderData ? undefined : quote.data?.selectedPaymentMethod;
  useEffect(() => {
    if (selected && selected !== paymentMethod)
      setValue('paymentMethod', selected as CheckoutFormValues['paymentMethod']);
  }, [selected, paymentMethod, setValue]);

  // The progress card stays at least this long, so placing an order never just flashes by.
  const placeStartedAt = useRef(0);
  const place = useMutation({
    onMutate: () => {
      placeStartedAt.current = Date.now();
    },
    mutationFn: (values: CheckoutFormValues) =>
      checkoutApi.place({
        ...checkoutFormToInput(values, idempotencyKey),
        shippingRateIds,
        couponCode: q?.coupon?.applied ? couponCode : null,
        redeemPoints,
        giftCardCode: q?.giftCard?.applied ? giftCardCode : null,
      }),
    onSuccess: async ({ order, payment }) => {
      const left = 3000 - (Date.now() - placeStartedAt.current);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      setPlaced(true);
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all, refetchType: 'none' });
      queryClient.setQueryData(queryKeys.orders.detail(order.orderNumber), order);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      if (signedIn) await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      // Online: off to the gateway's page. If it could not be opened, the order page offers "Pay now".
      if (payment) {
        window.location.assign(payment.redirectUrl);
        return;
      }
      if (isOnlinePayment(order.paymentMethod)) {
        router.replace(
          signedIn
            ? `/account/orders/${encodeURIComponent(order.orderNumber)}`
            : `/track-order?order=${encodeURIComponent(order.orderNumber)}`,
        );
        return;
      }
      router.replace(`/checkout/success?order=${encodeURIComponent(order.orderNumber)}`);
    },
    onError: async () => {
      // Stock or prices may have changed: refresh both so the summary explains why.
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });

  const onSubmit = handleSubmit(
    (values) => place.mutate(values),
    () => {
      // Hidden address fields failed validation: take the customer back there.
      flag(0);
      setStep(0);
    },
  );

  const wrap = `${container} flex max-w-[1240px] flex-col gap-5 pb-14 pt-[clamp(16px,2.4vw,28px)]`;
  // One overlay instance from "Place order" until the next page opens: it is always the first
  // child of the returned fragment, so React keeps it mounted (no re-animation, no flicker).
  const overlay =
    place.isPending || placed ? (
      <PlacingOverlay key="placing" online={isOnlinePayment(paymentMethod)} done={placed} />
    ) : null;
  // After success we redirect (gateway / success page); keep the progress card up meanwhile.
  if (placed) return <>{overlay}</>;
  if (cartLoading || me.isPending) return <Spinner className="mx-auto p-8" />;
  if (cartError) {
    return (
      <div className={wrap}>
        <Alert tone="error" title="Could not load your cart">
          {cartError.message}
        </Alert>
      </div>
    );
  }
  if (!cart || cart.itemCount === 0) {
    return (
      <div className={wrap}>
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-14 text-center">
          <h2 className="text-2xl font-extrabold">Your cart is empty</h2>
          <p className="text-gray-500">Add something to your cart before checking out.</p>
          <Link
            href="/products"
            className="mt-1.5 rounded-2xl bg-brand-600 px-6 py-3.5 font-bold text-white hover:text-white"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const q = quote.data;
  const savedAddresses = signedIn ? (addresses.data ?? []) : [];
  const online = isOnlinePayment(paymentMethod);
  const [email, fullName, phone, line1] = watch(['email', 'fullName', 'phone', 'line1']);
  const addressDone =
    (signedIn || /\S+@\S+\.\S+/.test(email)) &&
    (Boolean(addressId) ||
      Boolean(
        fullName.trim() &&
        phone.trim() &&
        line1.trim() &&
        city.trim() &&
        countryCode.trim().length === 2,
      ));
  const deliveryDone = Boolean(q) && q!.groups.every((g) => g.shippingOptions.length > 0);
  const paymentDone = Boolean(
    q?.paymentOptions.some((o) => o.method === paymentMethod && o.available),
  );
  const steps = [
    { label: 'Address', done: addressDone, required: true },
    { label: 'Delivery', done: deliveryDone, required: true },
    { label: 'Payment', done: paymentDone, required: true },
    { label: 'Review', done: false, required: false },
  ];
  const missing = steps.filter((st) => st.required && !st.done).map((st) => st.label);
  const ready = missing.length === 0 && reached >= steps.length - 1;
  const scrollUp = () =>
    document
      .getElementById('checkout-steps')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goTo = (i: number) => {
    // Back to any step; forward only as far as already reached with Continue.
    setStep(Math.min(i, reached));
    scrollUp();
  };
  const next = async () => {
    if (step === 0) {
      const ok = await trigger([
        'email',
        'fullName',
        'phone',
        'line1',
        'line2',
        'city',
        'state',
        'postalCode',
        'countryCode',
      ]);
      if (!ok || !addressDone) return flag(0);
    } else if (steps[step]?.required && !steps[step]?.done) return flag(step);
    setFlagged((f) => f.filter((x) => x !== step));
    const to = Math.min(step + 1, steps.length - 1);
    setStep(to);
    setReached((r) => Math.max(r, to));
    scrollUp();
  };
  const chosenAddress = savedAddresses.find((a) => a.id === addressId);
  const typedAddress = [line1, city, state, countryCode].filter((x) => x?.trim()).join(', ');

  return (
    <>
      {overlay}
      <div className={wrap}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[clamp(28px,3.4vw,42px)] font-extrabold leading-none tracking-display">
            Checkout
          </h1>
          <Link href="/cart" className="text-sm font-semibold text-brand-700">
            ← Back to cart
          </Link>
        </div>
        <nav
          id="checkout-steps"
          aria-label="Checkout steps"
          className="scroll-mt-[calc(var(--header-h)+16px)] rounded-3xl bg-white px-4 py-4 ring-1 ring-black/[.04] sm:px-6"
        >
          <ol className="flex items-start">
            {steps.map((st, i) => {
              const confirmed = i < reached;
              const status =
                i === step
                  ? flagged.includes(i)
                    ? 'error'
                    : 'current'
                  : confirmed && st.done
                    ? 'done'
                    : (confirmed && st.required) || flagged.includes(i)
                      ? 'error'
                      : 'todo';
              const sub =
                status === 'done'
                  ? 'Done'
                  : status === 'error'
                    ? 'Needs info'
                    : !st.required
                      ? 'Optional'
                      : i === step
                        ? 'In progress'
                        : 'To do';
              // The line to the next step fills once this step is done.
              const lineDone = i < steps.length - 1 && confirmed && st.done;
              return (
                <li key={st.label} className="relative flex flex-1 flex-col items-center">
                  {i < steps.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute left-1/2 right-[-50%] top-[15px] h-[2px] rounded-full bg-gray-100"
                    >
                      <span
                        className={cn(
                          'block h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out',
                          lineDone ? 'w-full' : 'w-0',
                        )}
                      />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === step ? 'step' : undefined}
                    className="group relative z-10 flex flex-col items-center gap-1.5 rounded-2xl px-1 text-center"
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold transition-colors duration-300',
                        status === 'done' && 'bg-brand-600 text-white',
                        status === 'current' && 'bg-white text-brand-700 ring-2 ring-brand-600',
                        status === 'error' && 'bg-red-500 text-white',
                        status === 'todo' && 'bg-gray-100 text-gray-400',
                      )}
                    >
                      {status === 'done' ? '✓' : status === 'error' ? '!' : i + 1}
                    </span>
                    <span
                      className={cn(
                        'text-[13px] font-bold leading-tight sm:text-sm',
                        status === 'todo' ? 'text-gray-500' : 'text-gray-900',
                        status === 'error' && 'text-red-700',
                      )}
                    >
                      {st.label}
                    </span>
                    <span
                      className={cn(
                        'hidden text-[11px] font-semibold sm:block',
                        status === 'done'
                          ? 'text-brand-600'
                          : status === 'error'
                            ? 'text-red-600'
                            : status === 'current'
                              ? 'text-brand-600'
                              : 'text-gray-400',
                      )}
                    >
                      {sub}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <form
          id="checkout-form"
          onSubmit={onSubmit}
          noValidate
          className="flex min-w-0 flex-wrap items-start gap-5"
        >
          <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-3.5">
            {step === 0 ? (
              <>
                <Panel
                  id="step-address"
                  title="1. Delivery address"
                  action={
                    savedAddresses.length > 0 && addressId !== '' ? (
                      <button
                        type="button"
                        onClick={() => setValue('addressId', '')}
                        className="text-sm font-bold text-brand-700"
                      >
                        + New address
                      </button>
                    ) : null
                  }
                >
                  {signedIn && me.data ? (
                    <p className="text-sm text-gray-600">
                      Signed in as{' '}
                      <span className="break-all font-semibold text-gray-900">{me.data.email}</span>
                    </p>
                  ) : (
                    <>
                      <Input
                        label="Email"
                        type="email"
                        autoComplete="email"
                        hint="Your receipt and order updates go here."
                        {...register('email')}
                        error={errors.email?.message}
                      />
                      <p className="text-sm text-gray-600">
                        Have an account?{' '}
                        <Link href="/login?next=/checkout" className="font-semibold text-brand-700">
                          Sign in
                        </Link>{' '}
                        to use saved addresses and earn points.
                      </p>
                    </>
                  )}
                  {savedAddresses.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2.5">
                      {savedAddresses.map((a) => (
                        <label key={a.id} className={cn(optionCard, 'flex-col gap-1 px-4 py-3.5')}>
                          <input
                            type="radio"
                            value={a.id}
                            className="sr-only"
                            {...register('addressId')}
                          />
                          <span className="flex min-w-0 justify-between gap-2 break-words font-bold">
                            <span>
                              {a.label || a.fullName}
                              {a.isDefault ? (
                                <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-700">
                                  Default
                                </span>
                              ) : null}
                            </span>
                            <RadioDot />
                          </span>
                          <span className="text-sm text-gray-600">
                            {a.fullName} · {a.phone}
                          </span>
                          <span className="break-words text-sm text-gray-600">
                            {formatAddress(a)}
                          </span>
                        </label>
                      ))}
                      <label
                        className={cn(optionCard, 'items-center justify-between gap-2 px-4 py-3.5')}
                      >
                        <input
                          type="radio"
                          value=""
                          className="sr-only"
                          {...register('addressId')}
                        />
                        <span className="font-bold">Use a new address</span>
                        <RadioDot />
                      </label>
                    </div>
                  ) : null}
                  {addressId === '' ? (
                    <div className="space-y-4">
                      <AddressInputs
                        fieldProps={(name) => ({ ...register(name), error: errors[name]?.message })}
                      />
                      {signedIn ? (
                        <Checkbox
                          label="Save this address to my account"
                          {...register('saveAddress')}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </Panel>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Panel id="step-delivery" title="2. Delivery, per seller">
                  {!q ? (
                    quote.error ? (
                      <Alert tone="error">{quote.error.message}</Alert>
                    ) : (
                      <Spinner />
                    )
                  ) : (
                    q.groups.map((g) => (
                      <div
                        key={g.vendor.id}
                        className="flex flex-col gap-2.5 rounded-[10px] bg-gray-50 p-3.5"
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <span className="min-w-0 break-words">
                            Sold by <b>{g.vendor.name}</b> · {g.items.length} item
                            {g.items.length === 1 ? '' : 's'}
                          </span>
                          <span className="text-gray-500">
                            Subtotal {formatMoney(g.subtotal, q.currency)}
                          </span>
                        </div>
                        {g.shippingOptions.length === 0 ? (
                          <p className="text-sm font-semibold text-red-600">
                            This seller doesn’t deliver to this address.
                          </p>
                        ) : (
                          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2">
                            {g.shippingOptions.map((opt) => (
                              <label
                                key={opt.rateId ?? 'default'}
                                className={cn(
                                  optionCard,
                                  'items-center justify-between gap-2 rounded-[8px] px-3 py-2.5 has-[:checked]:bg-white',
                                )}
                              >
                                <input
                                  type="radio"
                                  name={`ship-${g.vendor.id}`}
                                  className="sr-only"
                                  // The customer's pick shows at once; the quote catches up after.
                                  checked={
                                    opt.rateId ===
                                      (shippingRateIds[g.vendor.id] ?? g.shippingRateId) ||
                                    g.shippingOptions.length === 1
                                  }
                                  onChange={() =>
                                    opt.rateId &&
                                    setShippingRateIds((s) => ({
                                      ...s,
                                      [g.vendor.id]: opt.rateId!,
                                    }))
                                  }
                                />
                                <span className="flex min-w-0 flex-col">
                                  <b className="text-sm">{opt.name}</b>
                                  {opt.estimatedDays ? (
                                    <span className="text-xs text-gray-500">
                                      {opt.estimatedDays}
                                    </span>
                                  ) : null}
                                </span>
                                <b className="flex-none whitespace-nowrap text-sm">
                                  {opt.price === 0 ? 'Free' : formatMoney(opt.price, q.currency)}
                                </b>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {q && q.shippingZone === null && q.freeShippingAbove > 0 ? (
                    <p className="text-xs text-gray-500">
                      Free delivery on orders over {formatMoney(q.freeShippingAbove, q.currency)}{' '}
                      per seller.
                    </p>
                  ) : null}
                </Panel>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Panel id="step-payment" title="3. Payment">
                  {q ? (
                    <div className="flex flex-col gap-2">
                      {q.paymentOptions.map((option) => {
                        const look = PAYMENT_LOOK[option.method] ?? {
                          k: '•',
                          tint: 'bg-tint-violet',
                        };
                        return (
                          <label
                            key={option.method}
                            className={cn(
                              optionCard,
                              'items-center gap-3.5 px-4 py-3.5',
                              !option.available && 'cursor-not-allowed opacity-60',
                            )}
                          >
                            <input
                              type="radio"
                              value={option.method}
                              className="sr-only"
                              disabled={!option.available}
                              {...register('paymentMethod')}
                            />
                            <span
                              className={cn(
                                'flex h-10 w-10 flex-none items-center justify-center rounded-xl font-extrabold',
                                look.tint,
                              )}
                            >
                              {look.k}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <b>{option.label}</b>
                              <span className="text-[13px] text-gray-500">
                                {option.description}
                                {option.fee > 0
                                  ? ` A ${formatMoney(option.fee, q.currency)} fee applies.`
                                  : ''}
                              </span>
                              {option.reason ? (
                                <span className="text-xs text-amber-700">{option.reason}</span>
                              ) : null}
                            </span>
                            <RadioDot size={22} />
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <Spinner />
                  )}
                  {online ? (
                    <p className="text-[13px] text-gray-500">
                      You’ll pay on a secure payment page. Your items are held while you pay.
                    </p>
                  ) : null}
                </Panel>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Panel title="4. Review your order">
                  <dl className="divide-y divide-gray-100 text-sm">
                    {[
                      {
                        label: 'Deliver to',
                        value: chosenAddress
                          ? `${chosenAddress.fullName} · ${formatAddress(chosenAddress)}`
                          : typedAddress || '—',
                        to: 0,
                      },
                      {
                        label: 'Delivery',
                        value:
                          q?.groups
                            .map(
                              (g) =>
                                `${g.vendor.name}: ${g.shippingMethod ?? 'Standard'} (${
                                  g.shipping === 0 ? 'Free' : formatMoney(g.shipping, q.currency)
                                })`,
                            )
                            .join(' · ') ?? '—',
                        to: 1,
                      },
                      {
                        label: 'Payment',
                        value:
                          q?.paymentOptions.find((o) => o.method === paymentMethod)?.label ??
                          paymentMethod,
                        to: 2,
                      },
                    ].map((r) => (
                      <div key={r.label} className="flex items-start gap-3 py-3">
                        <dt className="w-20 flex-none text-gray-500 sm:w-24">{r.label}</dt>
                        <dd className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">
                          {r.value}
                        </dd>
                        <button
                          type="button"
                          onClick={() => goTo(r.to)}
                          className="flex-none text-sm font-bold text-brand-700 hover:text-brand-900"
                        >
                          Change
                        </button>
                      </div>
                    ))}
                  </dl>
                </Panel>
                <Panel id="step-savings" title="Savings (optional)">
                  {q?.loyalty && q.loyalty.balance > 0 ? (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-brand-100 px-4 py-3.5">
                      <span className="flex min-w-0 flex-col">
                        <b>Use my points</b>
                        <span className="text-[13px] text-gray-600">
                          {q.loyalty.balance.toLocaleString()} available · up to{' '}
                          {Math.min(q.loyalty.balance, q.loyalty.maxPoints).toLocaleString()} on
                          this order
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={redeemPoints}
                        onChange={(e) => setRedeemPoints(e.target.checked)}
                      />
                      <span
                        aria-hidden
                        className="relative h-[26px] w-11 flex-none rounded-full bg-gray-300 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-600 peer-checked:after:left-[21px]"
                      />
                    </label>
                  ) : null}

                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      <input
                        aria-label="Coupon code"
                        placeholder="Coupon code"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setCouponCode(couponInput.trim() || null);
                          }
                        }}
                        className={codeInput}
                      />
                      {couponCode ? (
                        <button
                          type="button"
                          className={darkButton}
                          onClick={() => {
                            setCouponCode(null);
                            setCouponInput('');
                          }}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={darkButton}
                          disabled={!couponInput.trim()}
                          onClick={() => setCouponCode(couponInput.trim())}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    {q?.coupon ? (
                      <p
                        className={cn(
                          'rounded-xl px-3 py-2 text-[13px] font-semibold',
                          q.coupon.applied
                            ? 'bg-tint-mint text-emerald-800'
                            : 'bg-tint-rose text-red-700',
                        )}
                      >
                        {q.coupon.applied
                          ? `${q.coupon.code} applied${q.coupon.message ? ` — ${q.coupon.message}` : ''}`
                          : q.coupon.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      <input
                        aria-label="Gift card code"
                        placeholder="Gift card code"
                        value={giftInput}
                        onChange={(e) => setGiftInput(e.target.value)}
                        className={codeInput}
                      />
                      {giftCardCode ? (
                        <button
                          type="button"
                          className={darkButton}
                          onClick={() => {
                            setGiftCardCode(null);
                            setGiftInput('');
                          }}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={darkButton}
                          disabled={!giftInput.trim()}
                          onClick={() => setGiftCardCode(giftInput.trim())}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    {q?.giftCard ? (
                      <p
                        className={cn(
                          'rounded-xl px-3 py-2 text-[13px] font-semibold',
                          q.giftCard.applied
                            ? 'bg-tint-mint text-emerald-800'
                            : 'bg-tint-rose text-red-700',
                        )}
                      >
                        {q.giftCard.applied
                          ? `${formatMoney(q.giftCard.amount, q.currency)} from ${q.giftCard.code} · ${formatMoney(q.giftCard.remainingBalance, q.currency)} left on the card`
                          : q.giftCard.message}
                      </p>
                    ) : null}
                  </div>
                </Panel>

                <Panel title="Order note (optional)">
                  <Textarea
                    aria-label="Order note"
                    placeholder="Delivery instructions, landmarks…"
                    rows={3}
                    {...register('customerNote')}
                    error={errors.customerNote?.message}
                  />
                </Panel>
              </>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(step - 1)}
                  className="h-12 flex-none rounded-2xl bg-white px-4 font-bold text-gray-700 hover:bg-gray-100 sm:px-5"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => void next()}
                  className="h-12 min-w-0 flex-1 rounded-2xl bg-brand-600 px-4 font-bold text-white hover:bg-brand-700 sm:flex-none sm:px-6"
                >
                  <span className="sm:hidden">Continue →</span>
                  <span className="hidden sm:inline">
                    Continue to {steps[step + 1]?.label.toLowerCase()} →
                  </span>
                </button>
              ) : null}
            </div>
          </div>

          <aside className="min-w-0 flex-[1_1_320px] lg:sticky lg:top-[calc(var(--header-h)+16px)]">
            <Panel title="Order review">
              {quote.isPending ? <Spinner /> : null}
              {q ? (
                <>
                  <div className="flex flex-col gap-2.5">
                    {q.groups.flatMap((g) =>
                      g.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2.5">
                          <div className="relative h-[52px] w-[52px] flex-none overflow-hidden rounded-xl bg-gray-50">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-full w-full object-contain p-1 mix-blend-multiply"
                              />
                            ) : null}
                            <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gray-900 px-1 text-[11px] font-bold text-white">
                              {item.quantity}
                            </span>
                          </div>
                          <span
                            className="min-w-0 flex-1 truncate text-sm"
                            title={item.productName}
                          >
                            {item.productName}
                            {item.variantName ? (
                              <span className="text-gray-500"> · {item.variantName}</span>
                            ) : null}
                          </span>
                          <b className="whitespace-nowrap text-sm">
                            {formatMoney(item.lineTotal, q.currency)}
                          </b>
                        </div>
                      )),
                    )}
                  </div>

                  <dl className="flex flex-col gap-2 border-t border-gray-200 pt-3.5 text-sm">
                    <SummaryRow label="Subtotal" value={formatMoney(q.subtotal, q.currency)} />
                    <SummaryRow
                      label="Delivery"
                      value={
                        q.shippingTotal === 0 ? 'Free' : formatMoney(q.shippingTotal, q.currency)
                      }
                    />
                    {q.discounts.map((d) => (
                      <SummaryRow
                        key={`${d.source}-${d.label}`}
                        label={d.label}
                        value={`−${formatMoney(d.amount, q.currency)}`}
                        tone="saving"
                      />
                    ))}
                    {q.loyalty && q.loyalty.pointsUsed > 0 ? (
                      <SummaryRow
                        label={`Points (${q.loyalty.pointsUsed})`}
                        value={`−${formatMoney(q.loyalty.amount, q.currency)}`}
                        tone="saving"
                      />
                    ) : null}
                    {q.giftCard?.applied ? (
                      <SummaryRow
                        label={`Gift card ${q.giftCard.code}`}
                        value={`−${formatMoney(q.giftCard.amount, q.currency)}`}
                        tone="saving"
                      />
                    ) : null}
                    {q.taxAdded > 0 ? (
                      <SummaryRow
                        label={t('checkout.tax')}
                        value={formatMoney(q.taxAdded, q.currency)}
                      />
                    ) : null}
                    {paymentMethod === 'COD' ? (
                      <SummaryRow label="COD fee" value={formatMoney(q.codFee, q.currency)} />
                    ) : null}
                  </dl>
                  <div className="flex items-baseline justify-between border-t border-gray-200 pt-3.5">
                    <span className="font-bold">Total</span>
                    <span className="text-[26px] font-extrabold tracking-[-0.02em]">
                      {formatMoney(q.grandTotal, q.currency)}
                    </span>
                  </div>
                  {q.taxIncluded > 0 ? (
                    <p className="-mt-2 text-right text-xs text-gray-500">
                      {t('checkout.includesTax', {
                        amount: formatMoney(q.taxIncluded, q.currency),
                      })}
                    </p>
                  ) : null}
                  {displayCurrency !== q.currency ? (
                    <p className="text-xs text-gray-500">
                      {t('checkout.chargedIn', { display: displayCurrency, base: q.currency })}
                    </p>
                  ) : null}
                  {q.problems.length > 0 ? (
                    <Alert tone="warning">
                      <ul className="list-disc space-y-1 pl-4">
                        {q.problems.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                      <Link href="/cart" className="mt-2 inline-block font-medium underline">
                        Review cart
                      </Link>
                    </Alert>
                  ) : null}
                </>
              ) : null}

              {place.error ? <Alert tone="error">{place.error.message}</Alert> : null}

              <Button
                type="submit"
                form="checkout-form"
                className="h-[54px] w-full rounded-2xl text-base font-bold"
                loading={place.isPending}
                disabled={!q?.canPlace || !ready}
              >
                {place.isPending
                  ? 'Placing order…'
                  : online
                    ? 'Continue to payment'
                    : 'Place order'}
              </Button>
              {!ready ? (
                <p className="-mt-1 text-center text-xs font-semibold text-red-600">
                  {missing.length > 0
                    ? `Complete ${missing.join(', ').toLowerCase()} to place your order.`
                    : 'Go through the steps and review your order to place it.'}
                </p>
              ) : null}
              <p className="text-center text-xs text-gray-500">
                By placing your order you agree to our terms and returns policy.
                {online ? ' Your items are held for a few minutes while you pay.' : ''}
              </p>
            </Panel>
          </aside>
        </form>
      </div>
    </>
  );
}

const PAYMENT_LOOK: Partial<Record<string, { k: string; tint: string }>> = {
  COD: { k: 'C', tint: 'bg-tint-yellow' },
  CARD: { k: '▭', tint: 'bg-tint-violet' },
  WALLET: { k: 'W', tint: 'bg-tint-mint' },
  BANK_TRANSFER: { k: 'B', tint: 'bg-tint-sky' },
};
