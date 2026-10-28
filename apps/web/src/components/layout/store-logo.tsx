/* eslint-disable @next/next/no-img-element -- the logo comes from object storage */
import Link from 'next/link';
import { cn } from '@ecommerce/ui';

/**
 * Store wordmark (or the uploaded logo). `tone` = ink on light backgrounds (default)
 * or bone on dark ones (footer band, campaign tiles).
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
  const mark = logoUrl ? (
    <img src={logoUrl} alt={name} className="h-8 w-auto" />
  ) : (
    <span
      className={cn(
        'group/logo flex items-center gap-2 leading-none',
        tone === 'light' ? 'text-gray-50' : 'text-gray-900',
        className,
      )}
    >
      <KadamMark className="h-7 w-7 flex-none" />
      <span className="type-display text-[30px] tracking-[0.02em]">{name}</span>
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
 * The KADAM mark: two forward-leaning strides inside a square. Uses currentColor for the
 * frame so it follows the text colour; the leading stride is always clay. On hover of the
 * wordmark the strides step forward a little.
 */
export function KadamMark({ className }: { className?: string }) {
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
      <path
        d="M9 23 13.5 9h4L13 23z"
        fill="currentColor"
        className="transition-transform duration-300 ease-out group-hover/logo:-translate-x-[1px]"
      />
      <path
        d="M16 23 20.5 9h4L20 23z"
        fill="#cf5a2a"
        className="transition-transform duration-300 ease-out group-hover/logo:translate-x-[1.5px]"
      />
    </svg>
  );
}
