'use client';

import * as React from 'react';
import { Button } from './button';
import { Portal } from './portal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Controlled confirmation modal (e.g. before deleting a record). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
        onClick={loading ? undefined : onCancel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          {description ? <div className="mt-2 text-sm text-gray-600">{description}</div> : null}
          {error ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button variant={tone} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
