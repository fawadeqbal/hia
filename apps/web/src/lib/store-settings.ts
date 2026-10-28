import type { PublicStoreSettings } from '@ecommerce/types';
import { settingsApi } from '@/lib/api-client';

/** Public store settings for server components (cached 60 s); null when the API is down. */
export async function getStoreSettings(): Promise<PublicStoreSettings | null> {
  return settingsApi.public({ next: { revalidate: 60 } }).catch(() => null);
}

export const storeName = (s: PublicStoreSettings | null) => s?.name || 'KADAM';
