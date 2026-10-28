'use client';

import * as React from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';
import { FieldShell } from './field';

export interface ImageUploadFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  /** Current image URL, or null when empty. */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Uploads the file and resolves to its public URL (e.g. mediaApi.uploadUrl). */
  upload: (file: File) => Promise<string>;
  /** Comma-separated MIME types for the file picker. */
  accept?: string;
  maxSizeMb?: number;
  /** Preview box size in px. */
  previewSize?: number;
  disabled?: boolean;
}

/** Click or drag-and-drop image upload with preview, progress state, replace and remove. */
export function ImageUploadField({
  label,
  hint,
  error,
  value,
  onChange,
  upload,
  accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif',
  maxSizeMb = 5,
  previewSize = 80,
  disabled,
}: ImageUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.');
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setUploadError(`The file is larger than ${maxSizeMb} MB.`);
      return;
    }
    setBusy(true);
    try {
      onChange(await upload(file));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const locked = disabled || busy;

  return (
    <FieldShell label={label} hint={hint} error={uploadError ?? error}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !locked) void handleFile(file);
        }}
        className={cn(
          'flex items-center gap-4 rounded-lg border border-dashed p-3 transition-colors',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-white',
          (uploadError ?? error) && 'border-red-400',
        )}
      >
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50"
          style={{ width: previewSize, height: previewSize }}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-gray-400">No image</span>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={busy}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={locked}
                onClick={() => onChange(null)}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">
            or drag and drop · JPEG, PNG, WebP, GIF, AVIF · max {maxSizeMb} MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>
    </FieldShell>
  );
}
