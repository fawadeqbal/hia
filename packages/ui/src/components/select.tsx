import * as React from 'react';
import { cn } from '../lib/cn';
import { FieldShell, fieldControlClass, fieldErrorClass } from './field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.ComponentProps<'select'> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  className,
  label,
  hint,
  error,
  id,
  options,
  placeholder,
  ...props
}: SelectProps) {
  const inputId = id ?? props.name;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      <select
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(fieldControlClass, 'h-10 bg-white', error && fieldErrorClass, className)}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
