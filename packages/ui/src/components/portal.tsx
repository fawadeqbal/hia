'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children at the end of <body>, so overlays (dialogs, sheets) always cover the whole
 * window — no parent transform, filter or z-index can trap them.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
