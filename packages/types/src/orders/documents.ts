/** Order notes: staff / seller notes, internal or shown to the customer. */

export const ORDER_NOTE_MAX = 2000;

export interface OrderNoteDto {
  id: string;
  content: string;
  isCustomerVisible: boolean;
  /** Null = whole order (staff note). */
  vendorOrderId: string | null;
  vendorName: string | null;
  author: { name: string; kind: 'STAFF' | 'SELLER' };
  createdAt: string;
  canDelete: boolean;
}

export interface OrderNoteInput {
  content: string;
  isCustomerVisible: boolean;
  /** Admin only: attach to one seller's sub-order. */
  vendorOrderId?: string | null;
}

/** What the customer sees on their order page. */
export interface CustomerOrderNoteDto {
  id: string;
  content: string;
  /** "Store" or the seller's name. */
  from: string;
  createdAt: string;
}
