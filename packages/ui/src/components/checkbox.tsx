import * as React from 'react';
import { cn } from '../lib/cn';

export interface CheckboxProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  label: string;
  description?: string;
}

export function Checkbox({ className, label, description, id, ...props }: CheckboxProps) {
  const inputId = id ?? props.name;
  return (
    <label htmlFor={inputId} className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        {...props}
      />
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {description ? <span className="block text-xs text-gray-500">{description}</span> : null}
      </span>
    </label>
  );
}
