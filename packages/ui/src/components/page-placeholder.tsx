import * as React from 'react';
import { Badge } from './badge';

export interface PagePlaceholderProps {
  title: string;
  description?: string;
  /** Scope items this screen must deliver (from the scope document). */
  features?: string[];
  children?: React.ReactNode;
}

/** Scaffold screen: shows what the page is responsible for until it is built. */
export function PagePlaceholder({
  title,
  description,
  features = [],
  children,
}: PagePlaceholderProps) {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <Badge tone="yellow">Scaffold</Badge>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description ? <p className="text-gray-600">{description}</p> : null}
      </header>
      {features.length > 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
          <p className="mb-3 text-sm font-semibold text-gray-700">To build</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {children}
    </section>
  );
}
