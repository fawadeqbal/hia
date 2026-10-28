import { ConflictException } from '@nestjs/common';
import { slugify } from '@ecommerce/types';

export interface UniqueSlugOptions {
  /** Slug the user typed (must be free) — or undefined to generate one. */
  requested?: string;
  /** Text to generate from when no slug was requested (usually the name). */
  source: string;
  /** Used when the source slugifies to an empty string, and in error messages. */
  entity: string;
  /** Returns true when another record already uses the slug. */
  isTaken: (slug: string) => Promise<boolean>;
  /** Field name for error messages (default "Slug"; e.g. "Code" for attributes). */
  label?: string;
}

/**
 * Shared slug rule for every entity with a public URL (categories, brands, products, vendors, pages…):
 * an explicit slug must be free; a generated one gets "-2", "-3"… until it is free.
 */
export async function uniqueSlug({
  requested,
  source,
  entity,
  isTaken,
  label = 'Slug',
}: UniqueSlugOptions): Promise<string> {
  if (requested) {
    if (await isTaken(requested)) {
      throw new ConflictException(`${label} "${requested}" is already used by another ${entity}`);
    }
    return requested;
  }

  const base = slugify(source) || entity;
  let slug = base;
  for (let i = 2; await isTaken(slug); i++) slug = `${base}-${i}`;
  return slug;
}
