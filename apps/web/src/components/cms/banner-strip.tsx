/* eslint-disable @next/next/no-img-element -- banners are served from object storage */
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PublicBannerDto } from '@ecommerce/types';
import { cn } from '@ecommerce/ui';

function BannerImage({ banner, tall }: { banner: PublicBannerDto; tall: boolean }) {
  const img = (
    <picture>
      {banner.mobileImageUrl ? (
        <source media="(max-width: 640px)" srcSet={banner.mobileImageUrl} />
      ) : null}
      <img
        src={banner.imageUrl}
        alt={banner.title}
        className={cn(
          'w-full rounded-2xl object-cover',
          tall ? 'aspect-[4/3] sm:aspect-[16/5]' : 'aspect-[16/4]',
        )}
      />
    </picture>
  );
  return banner.linkUrl ? (
    <Link href={banner.linkUrl} className="block">
      {img}
    </Link>
  ) : (
    img
  );
}

/**
 * One banner = full width. Several = swipeable row (CSS scroll-snap, no JavaScript).
 * Renders `fallback` when there are no live banners.
 */
export function BannerStrip({
  banners,
  variant = 'hero',
  fallback = null,
}: {
  banners: PublicBannerDto[];
  variant?: 'hero' | 'strip';
  fallback?: ReactNode;
}) {
  if (banners.length === 0) return <>{fallback}</>;
  const tall = variant === 'hero';
  if (banners.length === 1) return <BannerImage banner={banners[0]} tall={tall} />;
  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2" aria-label="Promotions">
      {banners.map((b) => (
        <div key={b.id} className="w-full shrink-0 snap-center">
          <BannerImage banner={b} tall={tall} />
        </div>
      ))}
    </div>
  );
}
