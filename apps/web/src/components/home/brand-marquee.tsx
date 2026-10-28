/* eslint-disable @next/next/no-img-element -- brand logos are served from object storage */
import Link from 'next/link';
import type { BrandDto } from '@ecommerce/types';

/**
 * Endless, auto-scrolling strip of brand logos (pauses on hover, edges fade out).
 * The list is rendered twice and shifted by exactly one copy, so the loop has no seam.
 * Brands without a logo show as a clean wordmark.
 */
export function BrandMarquee({
  brands,
}: {
  brands: Pick<BrandDto, 'id' | 'name' | 'slug' | 'logoUrl'>[];
}) {
  if (brands.length === 0) return null;
  // Short lists are repeated so one copy is always wider than the screen.
  const base = brands.length < 8 ? [...brands, ...brands, ...brands].slice(0, 12) : brands;
  const seconds = Math.max(24, base.length * 3.2);

  const row = (copy: number) =>
    base.map((b, i) => (
      <Link
        key={`${copy}-${b.id}-${i}`}
        href={`/brands/${b.slug}`}
        aria-hidden={copy > 0 ? true : undefined}
        tabIndex={copy > 0 ? -1 : undefined}
        title={b.name}
        className="group/brand flex h-24 min-w-[170px] flex-none items-center justify-center border-r border-gray-200 px-10 sm:h-28 sm:min-w-[210px]"
      >
        {b.logoUrl ? (
          <img
            src={b.logoUrl}
            alt={b.name}
            loading="lazy"
            className="max-h-11 max-w-full object-contain opacity-70 grayscale transition-all duration-300 group-hover/brand:opacity-100 group-hover/brand:grayscale-0 sm:max-h-12"
          />
        ) : (
          <span className="type-display whitespace-nowrap text-[30px] text-gray-400 transition-colors duration-300 group-hover/brand:text-gray-900 sm:text-[34px]">
            {b.name}
          </span>
        )}
      </Link>
    ));

  return (
    <div className="brand-marquee group/marquee relative overflow-hidden border-y border-gray-200 [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]">
      <style>
        {'.brand-marquee__track{animation:brand-marquee var(--brand-speed) linear infinite}' +
          '.brand-marquee:hover .brand-marquee__track{animation-play-state:paused}' +
          '@keyframes brand-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
          '@media (prefers-reduced-motion:reduce){.brand-marquee__track{animation:none}}'}
      </style>
      <div
        className="brand-marquee__track flex w-max"
        style={{ ['--brand-speed' as string]: `${seconds}s` }}
      >
        {row(0)}
        {row(1)}
      </div>
    </div>
  );
}
