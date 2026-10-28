import { ORDER_PROGRESS, ORDER_STATUS_LABELS, type OrderStatus } from '@ecommerce/types';
import { cn } from '@ecommerce/ui';

/** Where in ORDER_PROGRESS a status sits (paid counts as confirmed, out-for-delivery as shipped). */
function stepIndex(status: OrderStatus): number {
  if (status === 'PENDING_PAYMENT') return -1; // nothing confirmed until it is paid
  const alias: Partial<Record<OrderStatus, OrderStatus>> = {
    PAID: 'COD_CONFIRMED',
    OUT_FOR_DELIVERY: 'SHIPPED',
  };
  const index = ORDER_PROGRESS.indexOf(alias[status] ?? status);
  return index === -1 ? 0 : index;
}

const ICONS = [
  'M5 12l4 4 10-10', // confirmed
  'M12 6v6l4 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', // processing
  'M21 8l-9-5-9 5 9 5 9-5ZM3 8v8l9 5 9-5V8', // packed
  'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', // shipped
  'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z', // delivered
];

/** Connected order tracker: icons on a line that fills up to the current step. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  const current = stepIndex(status);
  return (
    <ol className="flex items-start">
      {ORDER_PROGRESS.map((step, i) => {
        const done = i <= current;
        const isCurrent = i === current;
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center gap-2 text-center">
            {i < ORDER_PROGRESS.length - 1 ? (
              <span aria-hidden className="absolute left-1/2 right-[-50%] top-[17px] h-[2px] rounded-full bg-gray-100">
                <span
                  className={cn(
                    'block h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out',
                    i < current ? 'w-full' : 'w-0',
                  )}
                />
              </span>
            ) : null}
            <span
              className={cn(
                'relative z-10 grid h-9 w-9 place-items-center rounded-full transition-colors',
                done ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400',
                isCurrent && 'ring-4 ring-brand-100',
              )}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <path d={ICONS[i] ?? ICONS[0]} />
              </svg>
            </span>
            <span
              className={cn(
                'text-xs leading-tight sm:text-[13px]',
                done ? 'font-semibold text-gray-900' : 'text-gray-500',
                isCurrent && 'text-brand-700',
              )}
            >
              {step === 'COD_CONFIRMED' ? 'Confirmed' : ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
