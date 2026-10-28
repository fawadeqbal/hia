import type { MetadataRoute } from 'next';
import type { SitemapEntries } from '@ecommerce/types';
import { blogApi, seoApi } from '@/lib/api-client';

export const revalidate = 3600;

/** Static routes, CMS pages, blog posts, products, categories, brands and seller stores. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const fixed: MetadataRoute.Sitemap = ['', '/products', '/blog', '/faq', '/track-order'].map(
    (path) => ({
      url: `${site}${path}`,
      changeFrequency: 'daily',
      priority: path === '' ? 1 : 0.7,
    }),
  );

  const cms: SitemapEntries = await blogApi
    .sitemap({ next: { revalidate: 3600 } })
    .catch(() => ({ pages: [], posts: [] }));

  const catalog = await seoApi
    .sitemap({ next: { revalidate: 3600 } })
    .catch(() => ({ products: [], categories: [], brands: [], stores: [] }));
  const entries = (
    list: { slug: string; updatedAt: string }[],
    prefix: string,
    changeFrequency: 'daily' | 'weekly',
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
    ...entries(catalog.categories, '/categories', 'daily', 0.8),
    ...entries(catalog.products, '/products', 'daily', 0.8),
    ...entries(catalog.brands, '/brands', 'weekly', 0.5),
    ...entries(catalog.stores, '/stores', 'weekly', 0.5),
    ...cms.pages.map((p) => ({
      url: `${site}/pages/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
    ...cms.posts.map((p) => ({
      url: `${site}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
