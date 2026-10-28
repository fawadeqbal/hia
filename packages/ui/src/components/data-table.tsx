import * as React from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './spinner';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Shown when rows is an empty array. */
  empty?: React.ReactNode;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/** Generic table used by every admin and vendor list screen. */
export function DataTable<T>({ columns, rows, rowKey, loading, empty }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500',
                  alignClass[c.align ?? 'left'],
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10">
                <Spinner className="justify-center" />
              </td>
            </tr>
          ) : rows && rows.length > 0 ? (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3 text-gray-700',
                      alignClass[c.align ?? 'left'],
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                {empty ?? <p className="px-4 py-10 text-center text-gray-500">No data</p>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
