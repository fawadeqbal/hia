'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';

export interface TooltipProps {
  /** Text (or small content) shown in the bubble. */
  content: React.ReactNode;
  /** Preferred side; flips when there is no room. */
  side?: 'top' | 'bottom';
  /** Delay before showing, in ms. */
  delay?: number;
  /** The trigger: a single element (button, link, …). */
  children: React.ReactElement<{ 'aria-describedby'?: string }>;
  className?: string;
}

/**
 * Small dark label for icon-only buttons and terse controls. Shows on mouse hover and keyboard
 * focus (not on touch), hides on Escape, and is rendered in <body> so no parent can clip it.
 */
export function Tooltip({
  content,
  side = 'bottom',
  delay = 150,
  children,
  className,
}: TooltipProps) {
  const id = React.useId();
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pos, setPos] = React.useState<{ x: number; y: number; side: 'top' | 'bottom' } | null>(
    null,
  );

  const show = React.useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = wrapRef.current?.firstElementChild ?? wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const roomBelow = window.innerHeight - r.bottom;
      const actual =
        side === 'bottom' ? (roomBelow < 48 ? 'top' : 'bottom') : r.top < 48 ? 'bottom' : 'top';
      setPos({
        x: r.left + r.width / 2,
        y: actual === 'bottom' ? r.bottom + 10 : r.top - 10,
        side: actual,
      });
    }, delay);
  }, [delay, side]);

  // Keep the bubble inside the window (e.g. buttons at the right edge); the arrow stays on target.
  const tipRef = React.useRef<HTMLSpanElement>(null);
  const [shift, setShift] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!pos || !tipRef.current) return setShift(0);
    const w = tipRef.current.offsetWidth;
    const left = Math.min(Math.max(pos.x - w / 2, 8), window.innerWidth - 8 - w);
    setShift(left - (pos.x - w / 2));
  }, [pos]);

  const hide = React.useCallback(() => {
    clearTimeout(timer.current);
    setPos(null);
  }, []);

  React.useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, { capture: true });
    };
  }, [pos, hide]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && show()}
      onBlur={hide}
    >
      {React.isValidElement(children)
        ? React.cloneElement(children, { 'aria-describedby': pos ? id : undefined })
        : children}
      {pos && typeof document !== 'undefined'
        ? createPortal(
            <span
              ref={tipRef}
              id={id}
              role="tooltip"
              style={{
                left: pos.x + shift,
                top: pos.y,
                transform: `translate(-50%, ${pos.side === 'top' ? '-100%' : '0'})`,
              }}
              className={cn(
                'pointer-events-none fixed z-[80] max-w-[240px] rounded-xl bg-gray-900 px-3 py-1.5 text-center text-xs font-semibold leading-snug text-white shadow-[0_8px_20px_-6px_rgba(17,15,32,.45)] ring-1 ring-white/10',
                pos.side === 'top' ? 'origin-bottom' : 'origin-top',
                className,
              )}
            >
              <style>
                {
                  '@keyframes tooltip-in{from{opacity:0;transform:translateY(-2px) scale(.96)}to{opacity:1;transform:none}}'
                }
              </style>
              <span
                className="block"
                style={{ animation: 'tooltip-in .14s cubic-bezier(.22,1,.36,1) both' }}
              >
                {content}
              </span>
              <span
                aria-hidden
                style={{ left: `calc(50% - ${shift}px)` }}
                className={cn(
                  'absolute h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-gray-900',
                  pos.side === 'bottom' ? '-top-[5px]' : '-bottom-[5px]',
                )}
              />
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
