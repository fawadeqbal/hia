/** Top-level folders in the bucket. Keeps uploads organised by what they belong to. */
export const MEDIA_FOLDERS = [
  'general',
  'categories',
  'brands',
  'products',
  'vendors',
  'banners',
  'blog',
  'reviews',
] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

/** Image types the API accepts (verified from file bytes, not the file name). */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export const MAX_UPLOAD_MB = 5;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export interface MediaDto {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  /** Public URL (CDN / MinIO). */
  url: string;
  /** Object key in the bucket, e.g. "brands/2026/10/uuid.png". */
  key: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  createdAt: string;
}
