import * as React from 'react';

/** Label + hint/error wrapper shared by Input, Textarea and Select. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const fieldControlClass =
  'block w-full rounded-lg border border-gray-300 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500';
export const fieldErrorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500';
