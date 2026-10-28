/**
 * Tiny toast store usable from anywhere (components, hooks, React Query callbacks).
 *   toast.success('Added to cart', { action: { label: 'View cart', href: '/cart' } })
 *   toast.error(error.message)
 */
export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  /** Small product picture (add to cart, wishlist). */
  image?: string | null;
  /** How long it stays, in ms. */
  duration: number;
}

type Options = Partial<Omit<ToastItem, 'id' | 'tone' | 'title'>>;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(list: ToastItem[]) => void>();
const emit = () => listeners.forEach((l) => l(items));

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function show(tone: ToastTone, title: string, options: Options = {}): number {
  const id = nextId++;
  const duration = options.duration ?? (tone === 'error' ? 5000 : 3500);
  // Same message twice in a row replaces the old one instead of stacking.
  items = [
    ...items.filter((t) => t.title !== title),
    { id, tone, title, ...options, duration },
  ].slice(-3);
  emit();
  setTimeout(() => dismissToast(id), duration);
  return id;
}

export const toast = {
  success: (title: string, options?: Options) => show('success', title, options),
  error: (title: string, options?: Options) => show('error', title, options),
  info: (title: string, options?: Options) => show('info', title, options),
};

export function subscribeToasts(listener: (list: ToastItem[]) => void): () => void {
  listeners.add(listener);
  listener(items);
  return () => listeners.delete(listener);
}

/** Small vibration on phones that support it (add to cart, save). */
export function haptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
}
