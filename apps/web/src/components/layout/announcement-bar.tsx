'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@ecommerce/ui';
import { container } from './container';

export interface Announcement {
  text: string;
  href?: string;
}

/**
 * Ink strip above the header. One message at a time: it ticks up every 4.5s, pauses while
 * hovered or focused, and can be stepped with the arrows. Utility links sit on the right.
 */
export function AnnouncementBar({
  messages,
  links,
}: {
  messages: Announcement[];
  links: { label: string; href: string; strong?: boolean }[];
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = messages.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % count), 4500);
    return () => clearInterval(id);
  }, [paused, count]);

  const step = (d: number) => setI((n) => (n + d + count) % count);
  const msg = messages[i];

  return (
    <div className="bg-gray-900 text-[12.5px] text-gray-300">
      <div className={`${container} flex h-9 items-center justify-between gap-4`}>
        <div
          className="flex min-w-0 flex-1 items-center justify-center gap-3 md:justify-start"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          aria-roledescription="carousel"
          aria-label="Store announcements"
        >
          {count > 1 ? <Arrow dir={-1} onClick={() => step(-1)} /> : null}
          <div className="relative h-9 min-w-0 flex-1 overflow-hidden md:max-w-[460px] md:flex-none">
            {msg ? (
              <p
                key={i}
                aria-live={paused ? 'off' : 'polite'}
                className="flex h-9 animate-ticker items-center justify-center truncate font-medium tracking-[0.02em] md:justify-start"
              >
                {msg.href ? (
                  <Link href={msg.href} className="link-grow text-gray-50 hover:text-white">
                    {msg.text}
                  </Link>
                ) : (
                  <span className="text-gray-50">{msg.text}</span>
                )}
              </p>
            ) : null}
          </div>
          {count > 1 ? <Arrow dir={1} onClick={() => step(1)} /> : null}
        </div>
        <nav aria-label="Help" className="hidden items-center gap-5 whitespace-nowrap md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={cn(
                'link-grow',
                l.strong
                  ? 'font-semibold text-accent hover:text-accent'
                  : 'text-gray-300 hover:text-white',
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Arrow({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir < 0 ? 'Previous announcement' : 'Next announcement'}
      className="grid h-6 w-6 flex-none place-items-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
    >
      <svg viewBox="0 0 16 16" aria-hidden className={cn('h-3 w-3', dir < 0 && 'rotate-180')}>
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
  );
}
