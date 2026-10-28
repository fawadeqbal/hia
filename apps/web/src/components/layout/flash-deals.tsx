'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** "Flash deals" pill at the end of the category bar, counting down to midnight. */
export function FlashDeals() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      setLeft(Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Link
      href="/products?onSale=true"
      className="ml-auto hidden h-10 flex-none items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-b from-[#fff7d1] to-[#ffefa6] pl-3 pr-1.5 text-sm font-bold text-gray-900 shadow-[inset_0_0_0_1px_rgba(230,180,0,.35)] transition-colors hover:from-[#fff1b3] hover:to-[#ffe680] hover:text-gray-900 sm:flex"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4 text-[#e0a800]">
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
      </svg>
      Flash deals
      {left !== null ? (
        <span className="hidden rounded-lg bg-gray-900 px-2 py-1 text-[13px] font-bold tabular-nums tracking-[.5px] text-white lg:inline">
          {pad(Math.floor(left / 3600))}:{pad(Math.floor(left / 60) % 60)}:{pad(left % 60)}
        </span>
      ) : null}
    </Link>
  );
}
