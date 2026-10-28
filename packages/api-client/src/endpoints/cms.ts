import type {
  BannerDto,
  BannerInput,
  BannerPlacement,
  FaqDto,
  FaqInput,
  MenuDto,
  MenuHandle,
  MenuInput,
  PageDto,
  PageInput,
  PageListItem,
  PublicBannerDto,
  PublicFaqGroup,
  PublicMenuItem,
  PublicPageDto,
} from '@ecommerce/types';
import { api, type RequestOptions } from '../http';

const ADMIN = '/admin/cms';

export const cmsApi = {
  // ---- storefront (public) ----
  page: (slug: string, options?: RequestOptions) =>
    api<PublicPageDto>(`/cms/pages/${encodeURIComponent(slug)}`, options),
  banners: (placement: BannerPlacement, options?: RequestOptions) =>
    api<PublicBannerDto[]>(`/cms/banners?placement=${encodeURIComponent(placement)}`, options),
  menu: (handle: MenuHandle, options?: RequestOptions) =>
    api<PublicMenuItem[]>(`/cms/menus/${handle}`, options),
  faqs: (options?: RequestOptions) => api<PublicFaqGroup[]>('/cms/faqs', options),

  // ---- admin: pages ----
  adminPages: () => api<PageListItem[]>(`${ADMIN}/pages`),
  getPage: (id: string) => api<PageDto>(`${ADMIN}/pages/${id}`),
  createPage: (body: PageInput) => api<PageDto>(`${ADMIN}/pages`, { method: 'POST', body }),
  updatePage: (id: string, body: Partial<PageInput>) =>
    api<PageDto>(`${ADMIN}/pages/${id}`, { method: 'PATCH', body }),
  removePage: (id: string) => api<void>(`${ADMIN}/pages/${id}`, { method: 'DELETE' }),

  // ---- admin: banners ----
  adminBanners: () => api<BannerDto[]>(`${ADMIN}/banners`),
  getBanner: (id: string) => api<BannerDto>(`${ADMIN}/banners/${id}`),
  createBanner: (body: BannerInput) => api<BannerDto>(`${ADMIN}/banners`, { method: 'POST', body }),
  updateBanner: (id: string, body: Partial<BannerInput>) =>
    api<BannerDto>(`${ADMIN}/banners/${id}`, { method: 'PATCH', body }),
  removeBanner: (id: string) => api<void>(`${ADMIN}/banners/${id}`, { method: 'DELETE' }),

  // ---- admin: menus ----
  adminMenus: () => api<MenuDto[]>(`${ADMIN}/menus`),
  getMenu: (handle: MenuHandle) => api<MenuDto>(`${ADMIN}/menus/${handle}`),
  saveMenu: (handle: MenuHandle, body: MenuInput) =>
    api<MenuDto>(`${ADMIN}/menus/${handle}`, { method: 'PUT', body }),

  // ---- admin: FAQs ----
  adminFaqs: () => api<FaqDto[]>(`${ADMIN}/faqs`),
  createFaq: (body: FaqInput) => api<FaqDto>(`${ADMIN}/faqs`, { method: 'POST', body }),
  updateFaq: (id: string, body: Partial<FaqInput>) =>
    api<FaqDto>(`${ADMIN}/faqs/${id}`, { method: 'PATCH', body }),
  removeFaq: (id: string) => api<void>(`${ADMIN}/faqs/${id}`, { method: 'DELETE' }),
};
