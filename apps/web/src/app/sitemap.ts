import type { MetadataRoute } from 'next';
import { seoApi } from '@/lib/api-client';

export const revalidate = 3600;

/** Static routes, products, categories and CMS pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const fixed: MetadataRoute.Sitemap = ['', '/products', '/contact', '/faq', '/track-order'].map(
    (path) => ({
      url: `${site}${path}`,
      changeFrequency: 'daily',
      priority: path === '' ? 1 : 0.7,
    }),
  );

  const data = await seoApi
    .sitemap({ next: { revalidate: 3600 } })
    .catch(() => ({ products: [], categories: [], pages: [] }));
  const entries = (
    list: { slug: string; updatedAt: string }[],
    prefix: string,
    changeFrequency: 'daily' | 'monthly',
    priority: number,
  ): MetadataRoute.Sitemap =>
    list.map((e) => ({
      url: `${site}${prefix}/${e.slug}`,
      lastModified: e.updatedAt,
      changeFrequency,
      priority,
    }));

  return [
    ...fixed,
    ...entries(data.categories, '/categories', 'daily', 0.8),
    ...entries(data.products, '/products', 'daily', 0.8),
    ...entries(data.pages, '/pages', 'monthly', 0.4),
  ];
}
