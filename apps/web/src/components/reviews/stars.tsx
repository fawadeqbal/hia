import { cn } from '@ecommerce/ui';

/** Read-only stars (rounded to the nearest half for display). */
export function Stars({ value, className }: { value: number; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span
      className={cn('inline-flex text-amber-500', className)}
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden className={i - 0.5 > rounded ? 'text-gray-300' : undefined}>
          {i <= rounded || i - 0.5 === rounded ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

/** Clickable 1–5 star input. */
export function StarInput({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (n: number) => void;
  error?: string;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label="Rating" className="flex gap-1 text-3xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className={n <= value ? 'text-amber-500' : 'text-gray-300 hover:text-amber-300'}
          >
            ★
          </button>
        ))}
      </div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
