'use client';

import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Time left until midnight (today's deals) as three tiles. Each digit pair re-mounts when it
 * changes, so it ticks in from below. Renders nothing until mounted (no hydration mismatch).
 */
export function DealsCountdown() {
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
  if (left === null) return <div className="h-[68px]" aria-hidden />;
  const parts: [string, string][] = [
    [pad(Math.floor(left / 3600)), 'Hrs'],
    [pad(Math.floor(left / 60) % 60), 'Min'],
    [pad(left % 60), 'Sec'],
  ];
  return (
    <div className="flex items-start gap-2" role="timer" aria-label="Time left on today's deals">
      {parts.map(([value, label]) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <span className="grid h-12 w-14 place-items-center overflow-hidden rounded-md bg-white/10 text-[24px] font-bold tabular-nums text-white">
            <span key={value} className="animate-ticker">
              {value}
            </span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
