import * as React from 'react';
import { Button } from './button';
import { Modal } from './modal';
import { Textarea } from './textarea';

export interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  label?: string;
  /** Minimum reason length (trimmed). */
  minLength?: number;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  error?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Confirmation that requires a written reason (cancel, reject, suspend…). */
export function ReasonDialog({
  open,
  title,
  description,
  label = 'Reason',
  minLength = 5,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
  error,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const [reason, setReason] = React.useState('');
  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const tooShort = reason.trim().length < minLength;

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={loading ? () => undefined : onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Back
          </Button>
          <Button
            variant={tone}
            loading={loading}
            disabled={tooShort}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <Textarea
        label={label}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint={`At least ${minLength} characters`}
        rows={3}
        autoFocus
      />
    </Modal>
  );
}
