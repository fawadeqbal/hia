import type {
  PublicRedirect,
  RedirectDto,
  RedirectImportResult,
  RedirectInput,
  SitemapDataDto,
} from '@ecommerce/types';
import { api, type RequestOptions } from '../http';

export const seoApi = {
  // ---- storefront (server / middleware) ----
  redirects: (options?: RequestOptions) => api<PublicRedirect[]>('/seo/redirects', options),
  sitemap: (options?: RequestOptions) => api<SitemapDataDto>('/seo/sitemap', options),

  // ---- admin ----
  adminRedirects: () => api<RedirectDto[]>('/admin/seo/redirects'),
  createRedirect: (body: RedirectInput) =>
    api<RedirectDto>('/admin/seo/redirects', { method: 'POST', body }),
  updateRedirect: (id: string, body: RedirectInput) =>
    api<RedirectDto>(`/admin/seo/redirects/${id}`, { method: 'PATCH', body }),
  removeRedirect: (id: string) => api<void>(`/admin/seo/redirects/${id}`, { method: 'DELETE' }),
  importRedirects: (text: string) =>
    api<RedirectImportResult>('/admin/seo/redirects/import', { method: 'POST', body: { text } }),
};
