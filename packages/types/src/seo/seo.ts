/** Sitemap data for the storefront. */
export interface SitemapUrl {
  slug: string;
  updatedAt: string;
}

export interface SitemapDataDto {
  products: SitemapUrl[];
  categories: SitemapUrl[];
  /** Published CMS pages (About, policies …). */
  pages: SitemapUrl[];
}
