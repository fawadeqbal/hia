import type { SitemapDataDto } from '@ecommerce/types';
import { api, type RequestOptions } from '../http';

export const seoApi = {
  sitemap: (options?: RequestOptions) => api<SitemapDataDto>('/seo/sitemap', options),
};
