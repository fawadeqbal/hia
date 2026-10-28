import * as React from 'react';
import { cn } from '../lib/cn';
import { FieldShell, fieldControlClass, fieldErrorClass } from './field';

export interface TextareaProps extends React.ComponentProps<'textarea'> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({ className, label, hint, error, id, rows = 4, ...props }: TextareaProps) {
  const inputId = id ?? props.name;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(fieldControlClass, 'py-2', error && fieldErrorClass, className)}
        {...props}
      />
    </FieldShell>
  );
}
