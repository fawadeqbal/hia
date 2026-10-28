'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Thin violet bar at the top while the next screen loads. Starts when an internal link is
 * clicked (or a filter form is submitted) and finishes when the URL changes.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  // URL changed: finish the bar, then hide it.
  useEffect(() => {
    setState((s) => (s === 'loading' ? 'done' : s));
    const t = setTimeout(() => setState((s) => (s === 'done' ? 'idle' : s)), 300);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    const start = () => setState('loading');
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as HTMLElement).closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return; // same page / hash link
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if ((form.method || 'get').toLowerCase() === 'get' && !e.defaultPrevented) start();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
    };
  }, []);

  if (state === 'idle') return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        className={
          state === 'loading'
            ? 'h-full origin-left animate-progress bg-accent'
            : 'h-full origin-left scale-x-100 bg-accent opacity-0 transition-[opacity,transform] duration-300'
        }
      />
    </div>
  );
}
