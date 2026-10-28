export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 50;

export type CartProblem = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'PRICE_CHANGED';

export const CART_PROBLEM_LABELS: Record<CartProblem, string> = {
  UNAVAILABLE: 'No longer available',
  OUT_OF_STOCK: 'Out of stock',
  INSUFFICIENT_STOCK: 'Not enough stock',
  PRICE_CHANGED: 'Price changed',
};

/** Problems that stop checkout (PRICE_CHANGED is informational). */
export const BLOCKING_CART_PROBLEMS: CartProblem[] = [
  'UNAVAILABLE',
  'OUT_OF_STOCK',
  'INSUFFICIENT_STOCK',
];

export interface CartItemDto {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  vendorId: string;
  unitPrice: number;
  /** Set once when the price changed since the item was added. */
  previousUnitPrice: number | null;
  quantity: number;
  available: number;
  lineTotal: number;
  problems: CartProblem[];
}

export interface CartVendorGroup {
  vendor: { id: string; name: string; slug: string };
  items: CartItemDto[];
  subtotal: number;
}

export interface CartDto {
  id: string | null;
  currency: string;
  itemCount: number;
  /** Sum of lines without blocking problems. Shipping, tax and discounts come at checkout. */
  subtotal: number;
  groups: CartVendorGroup[];
  canCheckout: boolean;
}

export interface SavedItemDto {
  id: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string | null;
  imageUrl: string | null;
  price: number;
  currency: string;
  available: number;
}

export interface AddToCartInput {
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

/** Money math in cents to avoid floating point drift. */
export const toCents = (amount: number) => Math.round(amount * 100);
export const fromCents = (cents: number) => cents / 100;
