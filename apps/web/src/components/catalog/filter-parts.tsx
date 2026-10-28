import type { ReactNode } from 'react';

/** Collapsible filter group. Opens by default when it has an active choice. */
export function FilterSection({
  title,
  active = 0,
  open,
  children,
}: {
  title: string;
  /** Number of active choices in this group (shown as a badge). */
  active?: number;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={open ?? active > 0}
      className="group/section border-b border-gray-200 py-0.5 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-gray-900 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          {active > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1.5 text-[11px] tracking-normal text-white">
              {active}
            </span>
          ) : null}
        </span>
        {/* Plus that turns into a minus: the vertical stroke rotates flat when open. */}
        <span aria-hidden className="relative h-3 w-3 text-gray-900">
          <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-current" />
          <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-current transition-transform duration-300 ease-out group-open/section:rotate-90 group-open/section:scale-y-0" />
        </span>
      </summary>
      <div className="flex animate-fade-in flex-col gap-0.5 pb-4">{children}</div>
    </details>
  );
}

/** Shows the first `visible` items; the rest sit behind "Show N more" (no JavaScript). */
export function ShowMore({
  items,
  visible = 6,
  keepOpen,
}: {
  items: ReactNode[];
  visible?: number;
  /** Open the extra items (e.g. a hidden item is selected). */
  keepOpen?: boolean;
}) {
  if (items.length <= visible + 1) return <>{items}</>;
  return (
    <>
      {items.slice(0, visible)}
      <details open={keepOpen} className="group/more">
        <summary className="cursor-pointer list-none px-1 py-1.5 text-[13px] font-semibold text-gray-900 underline underline-offset-4 [&::-webkit-details-marker]:hidden">
          <span className="group-open/more:hidden">Show {items.length - visible} more</span>
          <span className="hidden group-open/more:inline">Show less</span>
        </summary>
        <div className="flex flex-col gap-2 pt-1">{items.slice(visible)}</div>
      </details>
    </>
  );
}
