import * as React from 'react';
import { cn } from '../lib/cn';

export function Spinner({ className, label = 'Loading…' }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-gray-500', className)} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
      {label}
    </div>
  );
}
