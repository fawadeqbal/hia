'use client';

import * as React from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';
import { FieldShell } from './field';

export interface GalleryImage {
  url: string;
  altText: string;
}

export interface ImageGalleryFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  value: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  /** Uploads one file and resolves to its public URL. */
  upload: (file: File) => Promise<string>;
  max?: number;
  accept?: string;
  maxSizeMb?: number;
}

/** Multi-image upload: drag & drop several files, reorder, remove. The first image is the main one. */
export function ImageGalleryField({
  label,
  hint,
  error,
  value,
  onChange,
  upload,
  max = 10,
  accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif',
  maxSizeMb = 5,
}: ImageGalleryFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const latest = React.useRef(value);
  latest.current = value;
  const [uploading, setUploading] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [problems, setProblems] = React.useState<string[]>([]);

  const remaining = max - value.length;

  const handleFiles = async (files: File[]) => {
    const issues: string[] = [];
    const accepted = files.filter((f) => {
      if (!f.type.startsWith('image/')) issues.push(`${f.name}: not an image`);
      else if (f.size > maxSizeMb * 1024 * 1024)
        issues.push(`${f.name}: larger than ${maxSizeMb} MB`);
      else return true;
      return false;
    });
    const room = max - latest.current.length;
    if (accepted.length > room)
      issues.push(`Only ${max} images allowed; ${accepted.length - room} skipped`);
    const batch = accepted.slice(0, Math.max(room, 0));

    setProblems(issues);
    if (batch.length === 0) return;
    setUploading(batch.length);
    const results = await Promise.allSettled(batch.map((f) => upload(f)));
    const added: GalleryImage[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') added.push({ url: r.value, altText: '' });
      else
        issues.push(
          `${batch[i].name}: ${r.reason instanceof Error ? r.reason.message : 'upload failed'}`,
        );
    });
    setProblems([...issues]);
    setUploading(0);
    if (added.length) onChange([...latest.current, ...added]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const move = (from: number, to: number) => {
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <FieldShell label={label} hint={hint} error={error}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (remaining > 0) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cn(
          'rounded-lg border border-dashed p-3 transition-colors',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-white',
          error && 'border-red-400',
        )}
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {value.map((img, index) => (
            <div
              key={`${img.url}-${index}`}
              className="group relative overflow-hidden rounded-md border border-gray-200 bg-gray-50"
            >
              <img
                src={img.url}
                alt={img.altText}
                className="aspect-square w-full object-contain"
              />
              {index === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Main
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-white/90 p-1">
                <button
                  type="button"
                  aria-label="Move left"
                  className="rounded px-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Remove image"
                  className="rounded px-1.5 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  ✕
                </button>
                <button
                  type="button"
                  aria-label="Move right"
                  className="rounded px-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                  disabled={index === value.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  →
                </button>
              </div>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div
              key={`uploading-${i}`}
              className="flex aspect-square items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-500"
            >
              Uploading…
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={remaining <= 0 || uploading > 0}
            onClick={() => inputRef.current?.click()}
          >
            Add images
          </Button>
          <span className="text-xs text-gray-500">
            {value.length}/{max} · drag & drop or click · first image is the main one · max{' '}
            {maxSizeMb} MB each
          </span>
        </div>
        {problems.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs text-red-600">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
        />
      </div>
    </FieldShell>
  );
}
