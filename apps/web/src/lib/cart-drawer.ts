'use client';

import { useSyncExternalStore } from 'react';

/**
 * Open/close state for the slide-in cart drawer, usable from anywhere:
 *   openCartDrawer({ justAdded: variantId })   // after add to cart
 *   openCartDrawer()                           // header bag button
 * `justAdded` lets the drawer highlight the line that was just added.
 */
export interface CartDrawerState {
  open: boolean;
  justAdded: string | null;
}

let state: CartDrawerState = { open: false, justAdded: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openCartDrawer(options: { justAdded?: string | null } = {}) {
  state = { open: true, justAdded: options.justAdded ?? null };
  emit();
}

export function closeCartDrawer() {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER: CartDrawerState = { open: false, justAdded: null };

export function useCartDrawer(): CartDrawerState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER,
  );
}
