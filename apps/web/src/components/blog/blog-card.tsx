/* eslint-disable @next/next/no-img-element -- covers are served from object storage */
import Link from 'next/link';
import type { PublicBlogCard } from '@ecommerce/types';
import { formatDate } from '@ecommerce/ui';

export function BlogCard({ post }: { post: PublicBlogCard }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <Link href={`/blog/${post.slug}`} className="block aspect-[1200/630] bg-gray-100">
        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-3xl text-brand-700">
            ✎
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {post.category ? (
          <Link
            href={`/blog?category=${post.category.slug}`}
            className="text-xs font-semibold uppercase tracking-wide text-brand-700"
          >
            {post.category.name}
          </Link>
        ) : null}
        <h2 className="text-lg font-semibold leading-snug text-gray-900">
          <Link href={`/blog/${post.slug}`} className="hover:text-brand-700">
            {post.title}
          </Link>
        </h2>
        {post.excerpt ? <p className="line-clamp-3 text-sm text-gray-600">{post.excerpt}</p> : null}
        <p className="mt-auto pt-2 text-xs text-gray-500">
          {formatDate(post.publishedAt)} · {post.readingMinutes} min read
        </p>
      </div>
    </article>
  );
}
