/** Saved products (one default wishlist per customer) and "notify me when back in stock" alerts. */

export interface WishlistItemDto {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  variantName: string | null;
  vendorName: string;
  imageUrl: string | null;
  currency: string;
  /** Current price (variant price, else the product's cheapest). */
  price: number;
  compareAtPrice: number | null;
  /** Price when saved; lower current price → "price dropped". */
  priceAtAdd: number | null;
  priceDropped: boolean;
  inStock: boolean;
  /** Product is no longer for sale (unpublished / store suspended). */
  unavailable: boolean;
  addedAt: string;
}

export interface WishlistDto {
  items: WishlistItemDto[];
  /** For heart icons across the store. */
  productIds: string[];
}

export interface WishlistAddInput {
  productId: string;
  variantId?: string | null;
}

export interface StockAlertInput {
  variantId: string;
  /** Guests: where to send the alert (signed-in customers use their account email). */
  email?: string;
}
