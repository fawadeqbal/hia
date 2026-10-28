/* eslint-disable @next/next/no-img-element -- the logo comes from object storage */
import Link from 'next/link';
import { cn } from '@ecommerce/ui';

/**
 * Store wordmark (or the uploaded logo). The first word of the name is set large and the rest
 * small underneath, so a long name like "HIA Furniture Solutions" fits the header.
 * `tone` = ink on light backgrounds (default) or bone on dark ones (footer band).
 */
export function StoreLogo({
  name,
  logoUrl,
  tone = 'dark',
  href = '/',
  className,
}: {
  name: string;
  logoUrl?: string | null;
  tone?: 'light' | 'dark';
  href?: string | null;
  className?: string;
}) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const mark = logoUrl ? (
    <img src={logoUrl} alt={name} className="h-9 w-auto" />
  ) : (
    <span
      className={cn(
        'group/logo flex items-center gap-2.5 leading-none',
        tone === 'light' ? 'text-gray-50' : 'text-gray-900',
        className,
      )}
    >
      <BrandMark className="h-8 w-8 flex-none" />
      <span className="flex flex-col">
        <span className="type-display text-[30px] tracking-[0.02em]">{first}</span>
        {rest.length > 0 ? (
          <span
            className={cn(
              'mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.16em]',
              tone === 'light' ? 'text-white/60' : 'text-gray-500',
            )}
          >
            {rest.join(' ')}
          </span>
        ) : null}
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label={`${name} home`} className="shrink-0 hover:text-inherit">
      {mark}
    </Link>
  ) : (
    mark
  );
}

/**
 * The shop mark: an office chair inside a square. Frame and chair follow the text colour;
 * the seat is always clay. On hover of the wordmark the chair rises a little (gas lift).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <g className="transition-transform duration-300 ease-out group-hover/logo:-translate-y-[1.5px]">
        <rect x="11" y="6.5" width="10" height="9" rx="2" fill="currentColor" />
        <rect x="9" y="16.5" width="14" height="3.2" rx="1.6" fill="#cf5a2a" />
      </g>
      <rect x="15" y="19.5" width="2" height="4.5" fill="currentColor" />
      <path
        d="M9 25.5h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
