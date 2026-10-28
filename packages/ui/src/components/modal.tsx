'use client';

import * as React from 'react';
import { cn } from '../lib/cn';
import { Portal } from './portal';

export interface ModalProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  /** Buttons row at the bottom. */
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  /** Extra classes for the dialog panel (optional; apps can restyle without changing the default). */
  className?: string;
  /** Extra classes for the dimmed backdrop. */
  overlayClassName?: string;
  children?: React.ReactNode;
}

/** Generic dialog for forms and detail views (ConfirmDialog is for yes/no questions). */
export function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  size = 'md',
  className,
  overlayClassName,
  children,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <Portal>
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4',
          overlayClassName,
        )}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={cn(
            'flex max-h-[90vh] w-full flex-col rounded-xl bg-white shadow-xl',
            size === 'lg' ? 'max-w-2xl' : 'max-w-md',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
            <div>
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
              {description ? <div className="mt-1 text-sm text-gray-500">{description}</div> : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
