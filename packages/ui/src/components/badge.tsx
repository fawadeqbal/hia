import * as React from 'react';
import { cn } from '../lib/cn';

type Tone = 'gray' | 'green' | 'yellow' | 'red' | 'blue';

const tones: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-brand-100 text-brand-800',
};

export function Badge({
  tone = 'gray',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
