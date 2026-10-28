import type { ReactNode } from 'react';
import { cn } from '@ecommerce/ui';

/** White rounded panel used by cart and checkout. */
export function Panel({
  id,
  title,
  action,
  className,
  children,
}: {
  id?: string;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        'flex min-w-0 flex-col gap-3.5 rounded-3xl bg-white p-4 ring-1 ring-black/[.04] sm:p-5',
        className,
      )}
    >
      {title || action ? (
        <div className="flex items-center justify-between gap-2.5">
          {title ? <h2 className="text-lg font-extrabold sm:text-xl">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Radio dot drawn next to option cards (the real input is visually hidden). */
export function RadioDot({ size = 20 }: { size?: 20 | 22 }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex flex-none items-center justify-center rounded-full border-[1.5px] border-gray-300 transition-colors group-has-[:checked]:border-brand-600',
        size === 22 ? 'h-[22px] w-[22px]' : 'h-5 w-5',
      )}
    >
      <span className="h-2.5 w-2.5 rounded-full bg-transparent group-has-[:checked]:bg-brand-600" />
    </span>
  );
}

/** Border/background of a selectable option card (label wrapping a hidden radio). */
export const optionCard =
  'group flex cursor-pointer rounded-2xl border border-gray-200 bg-white text-gray-900 transition-colors duration-200 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300';

export const codeInput =
  'h-[46px] min-w-0 flex-1 rounded-[8px] border-[1.5px] border-gray-200 bg-white px-3.5 uppercase placeholder:normal-case focus:border-brand-500 focus:outline-none';

export const darkButton =
  'flex-none rounded-[8px] bg-gray-900 px-4 font-bold text-white hover:bg-gray-800 disabled:opacity-50';

export function SummaryRow({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'saving';
}) {
  return (
    <div className={cn('flex justify-between gap-3', tone === 'saving' && 'text-emerald-700')}>
      <dt className={cn('min-w-0', tone !== 'saving' && 'text-gray-600')}>{label}</dt>
      <dd className="flex-none text-right font-bold">{value}</dd>
    </div>
  );
}
