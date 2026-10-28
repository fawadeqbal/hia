import type {
  BlogCategoryDto,
  BlogCategoryInput,
  BlogPostDto,
  BlogPostInput,
  BlogPostListItem,
  BlogPostQuery,
  Paginated,
  PublicBlogCard,
  PublicBlogPost,
  SitemapEntries,
} from '@ecommerce/types';
import { api, type RequestOptions } from '../http';

const ADMIN = '/admin/cms/blog';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const blogApi = {
  // ---- storefront ----
  posts: (q: BlogPostQuery = {}, options?: RequestOptions) =>
    api<Paginated<PublicBlogCard>>(`/cms/blog${toQuery(q)}`, options),
  post: (slug: string, options?: RequestOptions) =>
    api<PublicBlogPost>(`/cms/blog/posts/${encodeURIComponent(slug)}`, options),
  categories: (options?: RequestOptions) => api<BlogCategoryDto[]>('/cms/blog/categories', options),
  sitemap: (options?: RequestOptions) => api<SitemapEntries>('/cms/sitemap', options),

  // ---- admin: posts ----
  adminPosts: () => api<BlogPostListItem[]>(`${ADMIN}/posts`),
  getPost: (id: string) => api<BlogPostDto>(`${ADMIN}/posts/${id}`),
  createPost: (body: BlogPostInput) => api<BlogPostDto>(`${ADMIN}/posts`, { method: 'POST', body }),
  updatePost: (id: string, body: Partial<BlogPostInput>) =>
    api<BlogPostDto>(`${ADMIN}/posts/${id}`, { method: 'PATCH', body }),
  removePost: (id: string) => api<void>(`${ADMIN}/posts/${id}`, { method: 'DELETE' }),

  // ---- admin: categories ----
  adminCategories: () => api<BlogCategoryDto[]>(`${ADMIN}/categories`),
  createCategory: (body: BlogCategoryInput) =>
    api<BlogCategoryDto>(`${ADMIN}/categories`, { method: 'POST', body }),
  updateCategory: (id: string, body: Partial<BlogCategoryInput>) =>
    api<BlogCategoryDto>(`${ADMIN}/categories/${id}`, { method: 'PATCH', body }),
  removeCategory: (id: string) => api<void>(`${ADMIN}/categories/${id}`, { method: 'DELETE' }),
};
