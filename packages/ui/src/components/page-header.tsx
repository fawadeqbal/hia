import * as React from 'react';

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        {breadcrumb ? <div className="text-sm text-gray-500">{breadcrumb}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description ? <p className="text-sm text-gray-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
