import type { PublicStoreSettings } from '@ecommerce/types';
import { settingsApi } from '@/lib/api-client';

/** Public store settings for server components (cached 60 s); null when the API is down. */
export async function getStoreSettings(): Promise<PublicStoreSettings | null> {
  return settingsApi.public({ next: { revalidate: 60 } }).catch(() => null);
}

export const storeName = (s: PublicStoreSettings | null) => s?.name || 'HIA Furniture Solutions';

export const DEFAULT_TAGLINE = 'Quality Products | Competitive Prices | Reliable Service';
export const storeTagline = (s: PublicStoreSettings | null) => s?.tagline || DEFAULT_TAGLINE;
