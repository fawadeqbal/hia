import type { Metadata } from 'next';
import Link from 'next/link';
import type { BlogCategoryDto, Paginated, PublicBlogCard } from '@ecommerce/types';
import { buttonStyles, cn } from '@ecommerce/ui';
import { BlogCard } from '@/components/blog/blog-card';
import { blogApi } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News, buying guides and tips from our store.',
};
export const revalidate = 60;

const PAGE_SIZE = 12;
const CACHE = { next: { revalidate: 60 } } as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const category = one(sp.category);
  const tag = one(sp.tag);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const empty: Paginated<PublicBlogCard> = {
    items: [],
    meta: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 },
  };
  const [posts, categories] = await Promise.all([
    blogApi.posts({ page, limit: PAGE_SIZE, category, tag }, CACHE).catch(() => empty),
    blogApi.categories(CACHE).catch((): BlogCategoryDto[] => []),
  ]);

  const href = (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
      if (v !== undefined && v !== '') qs.set(k, String(v));
    const s = qs.toString();
    return s ? `/blog?${s}` : '/blog';
  };
  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-3 py-1 text-sm',
      active
        ? 'border-brand-600 bg-brand-600 text-white'
        : 'border-gray-300 text-gray-700 hover:border-brand-400',
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Blog</h1>
      <p className="mt-2 text-gray-600">News, buying guides and tips.</p>

      {categories.length > 0 ? (
        <nav aria-label="Blog categories" className="mt-6 flex flex-wrap gap-2">
          <Link href="/blog" className={chip(!category)}>
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={href({ category: c.slug })}
              className={chip(category === c.slug)}
            >
              {c.name} <span className="opacity-70">{c.postCount}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {tag ? (
        <p className="mt-4 text-sm text-gray-600">
          Tagged <span className="font-medium">#{tag}</span> ·{' '}
          <Link href={href({ category })} className="text-brand-700 hover:underline">
            clear
          </Link>
        </p>
      ) : null}

      {posts.items.length === 0 ? (
        <p className="mt-10 text-gray-500">No posts yet.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.items.map((p) => (
            <BlogCard key={p.slug} post={p} />
          ))}
        </div>
      )}

      {posts.meta.totalPages > 1 ? (
        <div className="mt-10 flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {posts.meta.page} of {posts.meta.totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={href({ category, tag, page: page - 1 })}
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
              >
                Newer
              </Link>
            ) : null}
            {page < posts.meta.totalPages ? (
              <Link
                href={href({ category, tag, page: page + 1 })}
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
              >
                Older
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
