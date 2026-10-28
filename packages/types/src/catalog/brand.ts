/** Brand as returned by the API. */
export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Row in the admin brand list. */
export interface BrandListItem extends BrandDto {
  productCount: number;
}

/** Body for POST /admin/catalog/brands and PATCH /admin/catalog/brands/:id. */
export interface BrandInput {
  name: string;
  slug?: string;
  logoUrl?: string | null;
  description?: string | null;
  isActive?: boolean;
}
