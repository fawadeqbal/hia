import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@ecommerce/ui';

/** Section title row: eyebrow + condensed display title on the left, "Shop all →" on the right. */
export function SectionHead({
  title,
  eyebrow,
  href,
  linkLabel = 'Shop all',
  tone = 'dark',
  children,
}: {
  title: string;
  /** Small label above the title (e.g. "Trending"). */
  eyebrow?: string;
  href?: string;
  linkLabel?: string;
  tone?: 'dark' | 'light';
  children?: ReactNode;
}) {
  const light = tone === 'light';
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          {eyebrow ? (
            <p className={cn('type-eyebrow mb-2', light ? 'text-accent' : 'text-gray-500')}>
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={cn(
              'type-display text-[clamp(38px,5vw,68px)]',
              light ? 'text-gray-50' : 'text-gray-900',
            )}
          >
            {title}
          </h2>
        </div>
        {children}
      </div>
      {href ? <ArrowLink href={href} label={linkLabel} tone={tone} /> : null}
    </div>
  );
}

/** Uppercase text link with an arrow that nudges right and an underline that grows on hover. */
export function ArrowLink({
  href,
  label,
  tone = 'dark',
  className,
}: {
  href: string;
  label: string;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group/arrow inline-flex flex-none items-center gap-2 pb-1 text-[12.5px] font-bold uppercase tracking-[0.1em]',
        tone === 'light' ? 'text-gray-50 hover:text-white' : 'text-gray-900 hover:text-gray-900',
        className,
      )}
    >
      <span className="link-grow">{label.replace(/\s*→$/, '')}</span>
      <span
        aria-hidden
        className="transition-transform duration-300 group-hover/arrow:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}

/**
 * Product rows: a swipeable row on phones (cards snap into place), a 4–5 column grid
 * from tablets up.
 */
export const productGrid =
  'scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:snap-none md:grid-cols-4 md:gap-x-4 md:gap-y-10 md:overflow-visible lg:grid-cols-5 md:px-0 [&>*]:w-[46%] [&>*]:flex-none [&>*]:snap-start sm:[&>*]:w-[31%] md:[&>*]:w-auto';
