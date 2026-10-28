/** Order notes: staff / seller notes, internal or shown to the customer. */

export const ORDER_NOTE_MAX = 2000;

export interface OrderNoteDto {
  id: string;
  content: string;
  isCustomerVisible: boolean;
  author: { name: string };
  createdAt: string;
  canDelete: boolean;
}

export interface OrderNoteInput {
  content: string;
  isCustomerVisible: boolean;
}

/** What the customer sees on their order page. */
export interface CustomerOrderNoteDto {
  id: string;
  content: string;
  createdAt: string;
}
