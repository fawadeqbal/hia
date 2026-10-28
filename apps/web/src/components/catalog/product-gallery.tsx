'use client';

/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { Portal, cn } from '@ecommerce/ui';

type Img = { url: string; altText: string | null };

/**
 * Product media viewer: thumbnail rail + main stage with hover zoom, swipe on phones,
 * and a full-screen lightbox (arrows, thumbnails, keyboard).
 */
export function ProductGallery({
  images,
  name,
  discount,
}: {
  images: Img[];
  name: string;
  discount?: number | null;
}) {
  const list = images.length > 0 ? images : [{ url: '', altText: null }];
  const n = list.length;
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const touchX = useRef<number | null>(null);
  const [dir, setDir] = useState(1);
  const [lbZoom, setLbZoom] = useState<{ x: number; y: number } | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const go = useCallback(
    (k: number) => {
      setI((prev) => {
        const next = ((k % n) + n) % n;
        setDir(next >= prev ? 1 : -1);
        return next;
      });
      setLbZoom(null);
    },
    [n],
  );
  // Keep the active thumbnail in view.
  useEffect(() => {
    railRef.current
      ?.querySelectorAll('[data-thumb]')
      [i]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [i]);
  const cur = list[i]!;

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [full, i, go]);

  const swipe = {
    onTouchStart: (e: TouchEvent) => (touchX.current = e.touches[0]?.clientX ?? null),
    onTouchEnd: (e: TouchEvent) => {
      const s = touchX.current;
      const end = e.changedTouches[0]?.clientX;
      touchX.current = null;
      if (s != null && end != null && Math.abs(end - s) > 40) go(i + (end < s ? 1 : -1));
    },
  };

  const arrow = (dir: -1 | 1, big = false) =>
    n > 1 ? (
      <button
        type="button"
        aria-label={dir < 0 ? 'Previous photo' : 'Next photo'}
        onClick={(e) => {
          e.stopPropagation();
          go(i + dir);
        }}
        className={cn(
          'absolute top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full bg-white text-gray-900 shadow-[0_6px_18px_-8px_rgba(23,21,19,.45)] transition-all duration-200 hover:bg-gray-900 hover:text-white',
          big
            ? 'h-12 w-12'
            : 'h-10 w-10 opacity-0 group-hover/stage:opacity-100 focus-visible:opacity-100',
          dir < 0 ? (big ? 'left-4' : 'left-3') : big ? 'right-4' : 'right-3',
        )}
      >
        <svg viewBox="0 0 16 16" aria-hidden className={cn('h-4 w-4', dir < 0 && 'rotate-180')}>
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
    ) : null;

  const thumbs = (vertical: boolean, dark = false) =>
    n > 1 ? (
      <div
        className={cn(
          'scrollbar-none flex gap-2 p-0.5',
          vertical ? 'flex-col overflow-y-auto' : 'overflow-x-auto',
        )}
      >
        {list.map((img, k) => (
          <button
            key={img.url + k}
            type="button"
            aria-label={`Photo ${k + 1}`}
            aria-current={k === i}
            data-thumb
            onMouseEnter={() => !dark && k !== i && go(k)}
            onClick={() => go(k)}
            className={cn(
              'relative h-[76px] w-[64px] flex-none overflow-hidden rounded-md p-1 transition-all duration-200',
              dark ? 'bg-white/10' : 'bg-canvas',
              k === i
                ? cn('ring-[1.5px]', dark ? 'ring-white' : 'ring-gray-900')
                : cn(
                    'ring-1 ring-transparent',
                    dark ? 'opacity-50 hover:opacity-100' : 'opacity-70 hover:opacity-100',
                  ),
            )}
          >
            <img
              src={img.url}
              alt=""
              className={cn('h-full w-full object-contain', !dark && 'mix-blend-multiply')}
            />
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">
      {/* Stage */}
      <div
        className="group/stage relative aspect-[4/5] min-w-0 flex-1 cursor-zoom-in overflow-hidden rounded-md bg-canvas sm:aspect-square"
        onMouseMove={(e) => {
          if (!window.matchMedia('(hover: hover)').matches) return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({
            x: ((e.clientX - r.left) / r.width) * 100,
            y: ((e.clientY - r.top) / r.height) * 100,
          });
        }}
        onMouseLeave={() => setZoom(null)}
        onClick={() => cur.url && setFull(true)}
        {...swipe}
      >
        {cur.url ? (
          <img
            key={cur.url}
            src={cur.url}
            alt={cur.altText ?? name}
            className="gal-in h-full w-full object-contain p-[6%] mix-blend-multiply transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] will-change-transform"
            style={{
              ['--gal-dx' as string]: `${dir * 28}px`,
              transform: zoom ? 'scale(2.2)' : 'scale(1)',
              transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : '50% 50%',
            }}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-gray-400">No photo yet</div>
        )}
        {discount ? (
          <span className="absolute left-4 top-4 rounded-sm bg-sale px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
            −{discount}%
          </span>
        ) : null}
        {n > 1 ? (
          <span className="absolute bottom-4 left-4 hidden text-[12px] font-semibold tabular-nums tracking-[0.08em] text-gray-900 md:block">
            {i + 1} / {n}
          </span>
        ) : null}
        {cur.url ? (
          <span className="pointer-events-none absolute bottom-4 right-4 hidden items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-900 opacity-0 transition-opacity duration-300 group-hover/stage:opacity-100 md:flex">
            Click to expand
          </span>
        ) : null}
        {arrow(-1)}
        {arrow(1)}
        {n > 1 ? (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 md:hidden">
            {list.map((_, k) => (
              <span
                key={k}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  k === i ? 'w-5 bg-gray-900' : 'w-1.5 bg-gray-300',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
      <style>
        {'.gal-in{animation:gal-in .45s cubic-bezier(.22,1,.36,1) both}' +
          '@keyframes gal-in{from{opacity:0;translate:var(--gal-dx,28px) 0}to{opacity:1;translate:0 0}}' +
          '@media (prefers-reduced-motion:reduce){.gal-in{animation:none}}'}
      </style>

      {/* Thumbnails: rail on desktop, row on phones */}
      <div ref={railRef} className="md:max-h-[560px]">
        <div className="hidden h-full md:block">{thumbs(true)}</div>
        <div className="md:hidden">{thumbs(false)}</div>
      </div>

      {/* Lightbox */}
      {full ? (
        <Portal>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${name} photos`}
            className="fixed inset-0 z-[100] flex animate-fade-in flex-col bg-gray-950/95 backdrop-blur-md"
            onClick={() => setFull(false)}
          >
            <div className="flex items-center justify-between px-5 py-4 text-white">
              <span className="truncate text-sm font-semibold text-white/80">
                {name} · {i + 1} / {n}
                <span className="ml-2 hidden text-white/50 sm:inline">· click photo to zoom</span>
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setFull(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl hover:bg-white/20"
              >
                ×
              </button>
            </div>
            <div
              className="relative flex min-h-0 flex-1 items-center justify-center px-4"
              {...swipe}
            >
              <div
                className="max-h-full max-w-full overflow-hidden rounded-md bg-canvas"
                onClick={(e) => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  setLbZoom((z) =>
                    z
                      ? null
                      : {
                          x: ((e.clientX - r.left) / r.width) * 100,
                          y: ((e.clientY - r.top) / r.height) * 100,
                        },
                  );
                }}
                onMouseMove={(e) => {
                  if (!lbZoom) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setLbZoom({
                    x: ((e.clientX - r.left) / r.width) * 100,
                    y: ((e.clientY - r.top) / r.height) * 100,
                  });
                }}
              >
                <img
                  key={cur.url}
                  src={cur.url}
                  alt={cur.altText ?? name}
                  className={cn(
                    'gal-in max-h-[calc(100dvh-200px)] max-w-full object-contain p-4 mix-blend-multiply transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
                    lbZoom ? 'cursor-zoom-out' : 'cursor-zoom-in',
                  )}
                  style={{
                    ['--gal-dx' as string]: `${dir * 40}px`,
                    transform: lbZoom ? 'scale(2.5)' : 'scale(1)',
                    transformOrigin: lbZoom ? `${lbZoom.x}% ${lbZoom.y}%` : '50% 50%',
                  }}
                />
              </div>
              {arrow(-1, true)}
              {arrow(1, true)}
            </div>
            <div className="flex justify-center px-4 py-4" onClick={(e) => e.stopPropagation()}>
              {thumbs(false, true)}
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
