/** Category as returned by the API. Dates are ISO strings. */
export interface CategoryDto {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Row in the admin category list (flattened tree, depth-first order). */
export interface CategoryListItem extends CategoryDto {
  depth: number;
  parentName: string | null;
  productCount: number;
  childCount: number;
}

/** Public nested tree used by the storefront menu. */
export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: CategoryTreeNode[];
}

export interface FlatCategoryOption {
  id: string;
  name: string;
  slug: string;
  depth: number;
  /** "Electronics › Smartphones" */
  path: string;
}

/** Flattens the public tree for <select> pickers (depth-first). */
export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  depth = 0,
  parents: string[] = [],
): FlatCategoryOption[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, slug: n.slug, depth, path: [...parents, n.name].join(' › ') },
    ...flattenCategoryTree(n.children, depth + 1, [...parents, n.name]),
  ]);
}

/** Body for POST /admin/catalog/categories and PATCH /admin/catalog/categories/:id. */
export interface CategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  position?: number;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}
