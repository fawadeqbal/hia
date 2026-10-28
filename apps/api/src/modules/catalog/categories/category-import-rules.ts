import {
  SLUG_REGEX,
  emptyImportResult,
  pushImportRow,
  slugify,
  type ImportResult,
  type SheetRow,
} from '@ecommerce/types';
import { booleanCell, cellText, isEmptyRow, numberCell } from '../../../common/utils/sheet-cells';

export interface CategoryNow {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  description: string | null;
  position: number;
  isActive: boolean;
}

/** Fields to save. parentSlug: null = top level, undefined = keep. */
export interface CategoryImportFields {
  name?: string;
  parentSlug?: string | null;
  description?: string | null;
  position?: number;
  isActive?: boolean;
}

export type CategoryImportChange =
  | { kind: 'create'; slug: string; fields: CategoryImportFields & { name: string } }
  | { kind: 'update'; id: string; slug: string; fields: CategoryImportFields };

/** "-" or "none" in the Parent column moves a category to the top level. */
const TOP_LEVEL = ['-', 'none', 'top', 'top level'];

/**
 * Checks a category upload. Rows are matched by slug (made from the name when the slug cell is empty);
 * the Parent column takes a parent's slug or name. A parent may be a category created higher up in the
 * same file. Pure (no Prisma) so it is unit-tested.
 */
export function planCategoryImport(
  rows: SheetRow[],
  existing: CategoryNow[],
  dryRun: boolean,
): { result: ImportResult; changes: CategoryImportChange[] } {
  const result = emptyImportResult(dryRun);
  const changes: CategoryImportChange[] = [];
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c.slug]));
  const slugById = new Map(existing.map((c) => [c.id, c.slug]));
  const parentOf = new Map(
    existing.map((c) => [c.slug, c.parentId ? (slugById.get(c.parentId) ?? null) : null]),
  );
  const seen = new Set<string>();

  /** true when `candidate` is `slug` itself or one of its sub-categories (would make a loop). */
  const isSelfOrBelow = (candidate: string, slug: string): boolean => {
    for (let s: string | null | undefined = candidate; s; s = parentOf.get(s))
      if (s === slug) return true;
    return false;
  };

  rows.forEach((row, i) => {
    if (isEmptyRow(row)) return;
    const line = i + 2;
    const problems: string[] = [];
    const name = cellText(row, 'name');
    const slugCell = cellText(row, 'slug').toLowerCase();
    const slug = slugCell || slugify(name);
    if (!slug) problems.push('Name is empty');
    else if (!SLUG_REGEX.test(slug) || slug.length > 140)
      problems.push('Slug may contain lowercase letters, numbers and hyphens only');
    if (slug && seen.has(slug)) problems.push('this category is in the file twice');
    const now = bySlug.get(slug);
    if (name && (name.length < 2 || name.length > 120))
      problems.push('Name must be 2–120 characters');
    if (!now && !name && slug) problems.push('Name is needed for a new category');

    const fields: CategoryImportFields = {};
    if (name) fields.name = name;
    const parentText = cellText(row, 'parent').toLowerCase();
    if (TOP_LEVEL.includes(parentText)) fields.parentSlug = null;
    else if (parentText) {
      const parent = bySlug.has(parentText) ? parentText : byName.get(parentText);
      if (!parent)
        problems.push(`no category "${cellText(row, 'parent')}" (earlier in the file or saved)`);
      else if (slug && isSelfOrBelow(parent, slug))
        problems.push('a category cannot be inside itself or its own sub-category');
      else fields.parentSlug = parent;
    }
    const description = cellText(row, 'description');
    if (description.length > 2000) problems.push('Description is longer than 2000 characters');
    else if (description) fields.description = description;
    const position = numberCell(row, 'position', 'Position', problems, {
      integer: true,
      min: 0,
      max: 100_000,
    });
    if (position !== undefined) fields.position = position;
    const active = booleanCell(row, 'active', 'Active', problems);
    if (active !== undefined) fields.isActive = active;

    if (problems.length) {
      pushImportRow(result, {
        line,
        key: slug || name,
        action: 'error',
        message: problems.join('; '),
      });
      return;
    }
    seen.add(slug);

    if (!now) {
      changes.push({ kind: 'create', slug, fields: { ...fields, name } });
      bySlug.set(slug, {
        id: '',
        slug,
        name,
        parentId: null,
        description: null,
        position: 0,
        isActive: true,
      });
      byName.set(name.toLowerCase(), slug);
      parentOf.set(slug, fields.parentSlug ?? null);
      const where = fields.parentSlug ? ` in ${fields.parentSlug}` : '';
      pushImportRow(result, { line, key: slug, action: 'create', message: `New: ${name}${where}` });
      return;
    }

    const notes: string[] = [];
    const nowParent = parentOf.get(slug) ?? null;
    if (fields.name !== undefined && fields.name !== now.name) notes.push(`name → ${fields.name}`);
    else delete fields.name;
    if (fields.parentSlug !== undefined && fields.parentSlug !== nowParent)
      notes.push(`parent → ${fields.parentSlug ?? 'top level'}`);
    else delete fields.parentSlug;
    if (fields.description !== undefined && fields.description !== (now.description ?? ''))
      notes.push('description');
    else delete fields.description;
    if (fields.position !== undefined && fields.position !== now.position)
      notes.push(`position → ${fields.position}`);
    else delete fields.position;
    if (fields.isActive !== undefined && fields.isActive !== now.isActive)
      notes.push(fields.isActive ? 'shown' : 'hidden');
    else delete fields.isActive;

    if (!notes.length) {
      pushImportRow(result, { line, key: slug, action: 'unchanged', message: null });
      return;
    }
    if (fields.parentSlug !== undefined) parentOf.set(slug, fields.parentSlug);
    changes.push({ kind: 'update', id: now.id, slug, fields });
    pushImportRow(result, {
      line,
      key: slug,
      action: 'update',
      message: `Change ${notes.join(', ')}`,
    });
  });

  return { result, changes };
}
