/** Event the support widget listens to. Other components open it with openSupport('optional question'). */
export const SUPPORT_OPEN_EVENT = 'support:open';

export function openSupport(question?: string): void {
  window.dispatchEvent(new CustomEvent(SUPPORT_OPEN_EVENT, { detail: { question } }));
}
