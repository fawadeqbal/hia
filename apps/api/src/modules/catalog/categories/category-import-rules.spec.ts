import { planCategoryImport, type CategoryNow } from './category-import-rules';

const cat = (over: Partial<CategoryNow>): CategoryNow => ({
  id: 'id',
  slug: 'slug',
  name: 'Name',
  parentId: null,
  description: null,
  position: 0,
  isActive: true,
  ...over,
});
const existing = [
  cat({ id: 'c1', slug: 'chair-parts', name: 'Chair Parts' }),
  cat({ id: 'c2', slug: 'gas-lifts', name: 'Gas Lifts', parentId: 'c1' }),
];

describe('category upload', () => {
  it('creates a new category (slug from the name), parent by slug or name', () => {
    const { result, changes } = planCategoryImport(
      [
        { name: 'Wheels & Castors', parent: 'Chair Parts' },
        { slug: 'nylon-wheels', name: 'Nylon Wheels', parent: 'wheels-castors' },
      ],
      existing,
      true,
    );
    expect(result).toMatchObject({ created: 2, errors: 0 });
    expect(changes).toEqual([
      {
        kind: 'create',
        slug: 'wheels-castors',
        fields: { name: 'Wheels & Castors', parentSlug: 'chair-parts' },
      },
      {
        kind: 'create',
        slug: 'nylon-wheels',
        fields: { name: 'Nylon Wheels', parentSlug: 'wheels-castors' },
      },
    ]);
  });

  it('updates only what changed; empty cells keep the current value', () => {
    const { result, changes } = planCategoryImport(
      [
        { slug: 'gas-lifts', name: 'Gas Lifts', active: 'no', position: '' },
        { slug: 'chair-parts', name: 'Chair Parts' },
      ],
      existing,
      true,
    );
    expect(changes).toEqual([
      { kind: 'update', id: 'c2', slug: 'gas-lifts', fields: { isActive: false } },
    ]);
    expect(result).toMatchObject({ updated: 1, unchanged: 1 });
    expect(result.rows[0]?.message).toBe('Change hidden');
  });

  it('moves to the top level with "-" and refuses loops and unknown parents', () => {
    const { result, changes } = planCategoryImport(
      [
        { slug: 'chair-parts', parent: 'gas-lifts' },
        { slug: 'gas-lifts', parent: '-' },
        { slug: 'x-new', name: 'Xtra', parent: 'nowhere' },
        { slug: 'BAD SLUG', name: 'Bad' },
        { slug: 'new-one' },
      ],
      existing,
      true,
    );
    expect(changes).toEqual([
      { kind: 'update', id: 'c2', slug: 'gas-lifts', fields: { parentSlug: null } },
    ]);
    expect(result.rows.map((r) => r.message)).toEqual([
      'a category cannot be inside itself or its own sub-category',
      'Change parent → top level',
      'no category "nowhere" (earlier in the file or saved)',
      'Slug may contain lowercase letters, numbers and hyphens only',
      'Name is needed for a new category',
    ]);
  });
});
