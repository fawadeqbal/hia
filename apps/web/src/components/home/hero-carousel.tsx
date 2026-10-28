'use client';

/* eslint-disable @next/next/no-img-element -- banners and products are served from object storage */
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicBannerDto } from '@ecommerce/types';
import { cn } from '@ecommerce/ui';
import { container } from '@/components/layout/container';

export interface HeroProduct {
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface HeroSlide {
  tag: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
  /** Tailwind background class. */
  bg: string;
  /** Text colour on that background. */
  tone?: 'light' | 'dark';
  /** Live products: the first is the hero shoe, the next ones are small thumbnails. */
  products?: HeroProduct[];
}

const INTERVAL = 6500;
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Full-bleed campaign hero.
 * - CMS banners (Admin → Content → Banners, "home.hero") show as full images; without them the
 *   built-in slides are used, each starring a live product photo.
 * - Slide change: background cross-fades, the headline rises line by line, the shoe glides in
 *   from the right with a slight tilt. On pointer devices the shoe follows the cursor a little.
 * - Numbered progress bars (01 02 03) fill over INTERVAL; hover or focus pauses; swipe on phones;
 *   ←/→ arrow buttons.
 */
export function HeroCarousel({
  banners,
  slides,
}: {
  banners: PublicBannerDto[];
  slides: HeroSlide[];
}) {
  const count = banners.length > 0 ? banners.length : slides.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const touchX = useRef<number | null>(null);

  const go = useCallback((i: number) => setActive(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setTimeout(() => go(active + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [active, count, paused, go]);

  const current = banners.length === 0 ? slides[active] : undefined;
  const light = banners.length > 0 || current?.tone !== 'dark';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="group/hero relative h-[clamp(520px,82vh,720px)] overflow-hidden bg-gray-900 md:h-[clamp(480px,74vh,680px)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setTilt({ x: 0, y: 0 });
      }}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onMouseMove={(e) => {
        if (!window.matchMedia('(hover: hover)').matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({
          x: (e.clientX - r.left) / r.width - 0.5,
          y: (e.clientY - r.top) / r.height - 0.5,
        });
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null || Math.abs(end - start) < 40) return;
        go(active + (end < start ? 1 : -1));
      }}
    >
      {banners.length > 0
        ? banners.map((b, i) => {
            const img = (
              <picture>
                {b.mobileImageUrl ? (
                  <source media="(max-width: 640px)" srcSet={b.mobileImageUrl} />
                ) : null}
                <img
                  src={b.imageUrl}
                  alt={b.title}
                  className={cn(
                    'h-full w-full object-cover transition-transform duration-[7000ms] ease-linear',
                    i === active ? 'scale-105' : 'scale-100',
                  )}
                />
              </picture>
            );
            return (
              <div
                key={b.id}
                aria-hidden={i !== active}
                className={cn(
                  'absolute inset-0 transition-opacity duration-700',
                  i === active ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
              >
                {b.linkUrl ? (
                  <Link href={b.linkUrl} className="block h-full" tabIndex={i === active ? 0 : -1}>
                    {img}
                  </Link>
                ) : (
                  img
                )}
              </div>
            );
          })
        : slides.map((s, i) => {
            const on = i === active;
            const dark = s.tone === 'dark';
            const items = (s.products ?? []).filter((p) => p.imageUrl);
            const star = items[0];
            const thumbs = items.slice(1, 4);
            return (
              <div
                key={s.title}
                aria-hidden={!on}
                className={cn(
                  'absolute inset-0 transition-opacity duration-700 ease-out',
                  s.bg,
                  on ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
              >
                {/* Giant outlined word in the background. */}
                <span
                  aria-hidden
                  className={cn(
                    'type-display pointer-events-none absolute -bottom-[0.12em] right-[-0.04em] select-none whitespace-nowrap text-[clamp(160px,26vw,420px)] text-transparent transition-transform duration-[1200ms] ease-out',
                    dark
                      ? '[-webkit-text-stroke:1.5px_rgba(23,21,19,.14)]'
                      : '[-webkit-text-stroke:1.5px_rgba(255,255,255,.22)]',
                    on ? 'translate-x-0' : 'translate-x-16',
                  )}
                >
                  {s.tag}
                </span>

                <div
                  className={cn(
                    container,
                    'relative grid h-full content-start gap-6 pb-24 pt-10 md:grid-cols-[1.05fr_1fr] md:content-center md:items-center md:pb-16',
                  )}
                >
                  {/* Copy */}
                  <div
                    className={cn(
                      'relative z-10 flex flex-col gap-5',
                      dark ? 'text-gray-900' : 'text-gray-50',
                    )}
                  >
                    <span
                      className={cn(
                        'type-eyebrow transition-all delay-100 duration-700 ease-out',
                        dark ? 'text-gray-700' : 'text-accent',
                        on ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                      )}
                    >
                      {s.tag}
                    </span>
                    <h2 className="type-display text-[clamp(52px,8.6vw,132px)]">
                      {s.title.split(' / ').map((line, k) => (
                        <span key={k} className="block overflow-hidden pb-[0.04em]">
                          <span
                            className={cn(
                              'block transition-transform duration-[900ms] ease-out',
                              on ? 'translate-y-0' : 'translate-y-[105%]',
                            )}
                            style={{ transitionDelay: on ? `${120 + k * 90}ms` : '0ms' }}
                          >
                            {line}
                          </span>
                        </span>
                      ))}
                    </h2>
                    <p
                      className={cn(
                        'max-w-[420px] text-[clamp(15px,1.3vw,18px)] transition-all delay-300 duration-700 ease-out',
                        dark ? 'text-gray-700' : 'text-white/80',
                        on ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                      )}
                    >
                      {s.sub}
                    </p>
                    <div
                      className={cn(
                        'flex flex-wrap items-center gap-4 transition-all delay-[400ms] duration-700 ease-out',
                        on ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                      )}
                    >
                      <Link
                        href={s.href}
                        tabIndex={on ? 0 : -1}
                        className={cn(
                          'group/cta inline-flex h-[52px] items-center gap-3 rounded-md px-7 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors',
                          dark
                            ? 'bg-gray-900 text-white hover:bg-white hover:text-gray-900'
                            : 'bg-white text-gray-900 hover:bg-gray-900 hover:text-white',
                        )}
                      >
                        {s.cta}
                        <span
                          aria-hidden
                          className="transition-transform duration-300 group-hover/cta:translate-x-1"
                        >
                          →
                        </span>
                      </Link>
                      {thumbs.length > 0 ? (
                        <div className="flex -space-x-2">
                          {thumbs.map((p) => (
                            <Link
                              key={p.slug}
                              href={`/products/${p.slug}`}
                              tabIndex={on ? 0 : -1}
                              title={p.name}
                              className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-canvas ring-2 ring-white/80 transition-transform duration-200 hover:z-10 hover:-translate-y-1"
                            >
                              <img
                                src={p.imageUrl!}
                                alt={p.name}
                                className="h-full w-full object-contain p-1 mix-blend-multiply"
                              />
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Hero shoe */}
                  {star ? (
                    <Link
                      href={`/products/${star.slug}`}
                      tabIndex={on ? 0 : -1}
                      aria-label={star.name}
                      className={cn(
                        'absolute inset-x-6 bottom-20 top-[46%] flex items-center justify-center md:relative md:inset-auto md:h-[min(62vh,520px)]',
                        'transition-[opacity,transform] duration-[1000ms] ease-out',
                        on ? 'translate-x-0 opacity-100' : 'translate-x-24 opacity-0',
                      )}
                      style={{ transitionDelay: on ? '150ms' : '0ms' }}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'absolute aspect-square w-[min(78%,420px)] rounded-full',
                          dark ? 'bg-white/50' : 'bg-white/10',
                        )}
                      />
                      <img
                        src={star.imageUrl!}
                        alt=""
                        loading={i === 0 ? 'eager' : 'lazy'}
                        className="relative max-h-full w-[min(92%,560px)] object-contain drop-shadow-[0_40px_40px_rgba(0,0,0,.35)] transition-transform duration-300 ease-out"
                        style={{
                          transform: `translate(${tilt.x * 22}px, ${tilt.y * 14}px) rotate(${-14 + tilt.x * 4}deg)`,
                        }}
                      />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}

      {/* Controls */}
      {count > 1 ? (
        <div
          className={cn(
            container,
            'pointer-events-none absolute inset-x-0 bottom-6 z-20 flex items-end justify-between gap-4',
          )}
        >
          <div className="pointer-events-auto flex gap-3">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === active}
                onClick={() => go(i)}
                className={cn(
                  'group/dot flex w-12 flex-col gap-1.5 text-left text-[11px] font-bold tabular-nums tracking-[0.1em] sm:w-16',
                  light ? 'text-white' : 'text-gray-900',
                )}
              >
                <span
                  className={cn(
                    'transition-opacity',
                    i === active ? 'opacity-100' : 'opacity-50 group-hover/dot:opacity-90',
                  )}
                >
                  {pad(i + 1)}
                </span>
                <span
                  className={cn(
                    'relative h-[2px] w-full overflow-hidden',
                    light ? 'bg-white/30' : 'bg-gray-900/20',
                  )}
                >
                  {i === active ? (
                    <span
                      key={`${active}-${paused}`}
                      className={cn(
                        'absolute inset-y-0 left-0',
                        light ? 'bg-white' : 'bg-gray-900',
                      )}
                      style={{
                        animation: paused ? 'none' : `hero-progress ${INTERVAL}ms linear forwards`,
                        width: paused ? '100%' : undefined,
                      }}
                    />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          <div className="pointer-events-auto hidden gap-2 sm:flex">
            {[-1, 1].map((d) => (
              <button
                key={d}
                type="button"
                aria-label={d < 0 ? 'Previous slide' : 'Next slide'}
                onClick={() => go(active + d)}
                className={cn(
                  'grid h-11 w-11 place-items-center rounded-full border transition-colors',
                  light
                    ? 'border-white/40 text-white hover:border-white hover:bg-white hover:text-gray-900'
                    : 'border-gray-900/30 text-gray-900 hover:border-gray-900 hover:bg-gray-900 hover:text-white',
                )}
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden
                  className={cn('h-4 w-4', d < 0 && 'rotate-180')}
                >
                  <path
                    d="m6 3 5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ))}
          </div>
          <style>{'@keyframes hero-progress{from{width:0}to{width:100%}}'}</style>
        </div>
      ) : null}
    </section>
  );
}
