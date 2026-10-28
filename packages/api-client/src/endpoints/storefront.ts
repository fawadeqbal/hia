import type {
  DidYouMean,
  ProductRecommendations,
  PublicBrandPage,
  PublicStorePage,
  SearchSuggestions,
  Paginated,
  StorefrontProductCard,
  StorefrontProductDetail,
  StorefrontProductQuery,
} from '@ecommerce/types';
import { api, type RequestOptions } from '../http';

function toQuery(params: StorefrontProductQuery): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Public catalog. Usable from server components (pass `next`/`cache` options). */
export const storefrontApi = {
  products: (params: StorefrontProductQuery = {}, options?: RequestOptions) =>
    api<Paginated<StorefrontProductCard>>(`/catalog/products${toQuery(params)}`, options),
  product: (slug: string, options?: RequestOptions) =>
    api<StorefrontProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`, options),
  /** Cards for a list of slugs, in the same order (recently viewed). */
  bySlugs: (slugs: string[], options?: RequestOptions) =>
    api<StorefrontProductCard[]>(
      `/catalog/products/by-slugs?slugs=${encodeURIComponent(slugs.join(','))}`,
      options,
    ),
  recommendations: (slug: string, options?: RequestOptions) =>
    api<ProductRecommendations>(`/recommendations/products/${encodeURIComponent(slug)}`, options),
  /** Records a product view (analytics). sessionId = anonymous id kept in localStorage. */
  recordView: (slug: string, sessionId: string) =>
    api<void>(`/catalog/products/${encodeURIComponent(slug)}/view`, {
      method: 'POST',
      body: { sessionId },
    }),
  brand: (slug: string, options?: RequestOptions) =>
    api<PublicBrandPage>(`/catalog/brands/${encodeURIComponent(slug)}`, options),
  store: (slug: string, options?: RequestOptions) =>
    api<PublicStorePage>(`/catalog/stores/${encodeURIComponent(slug)}`, options),
};

export const searchApi = {
  suggest: (q: string) => api<SearchSuggestions>(`/search/suggest?q=${encodeURIComponent(q)}`),
  didYouMean: (q: string, options?: RequestOptions) =>
    api<DidYouMean>(`/search/did-you-mean?q=${encodeURIComponent(q)}`, options),
};
