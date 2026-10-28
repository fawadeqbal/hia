import * as React from 'react';
import { cn } from '../lib/cn';
import { FieldShell, fieldControlClass, fieldErrorClass } from './field';

export interface InputProps extends React.ComponentProps<'input'> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ className, label, hint, error, id, ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(fieldControlClass, 'h-10', error && fieldErrorClass, className)}
        {...props}
      />
    </FieldShell>
  );
}
