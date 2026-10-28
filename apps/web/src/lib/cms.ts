import type {
  BannerPlacement,
  MenuHandle,
  PublicBannerDto,
  PublicMenuItem,
} from '@ecommerce/types';
import { cmsApi } from '@/lib/api-client';

/** CMS content changes rarely: cache for a minute. Failures (API down, build time) fall back to defaults. */
const CACHE = { next: { revalidate: 60 } } as const;

export async function getBanners(placement: BannerPlacement): Promise<PublicBannerDto[]> {
  try {
    return await cmsApi.banners(placement, CACHE);
  } catch {
    return [];
  }
}

export async function getMenu(handle: MenuHandle): Promise<PublicMenuItem[]> {
  try {
    return await cmsApi.menu(handle, CACHE);
  } catch {
    return [];
  }
}
