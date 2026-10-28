/* eslint-disable @next/next/no-img-element -- covers are served from object storage */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { formatDate } from '@ecommerce/ui';
import { BlogCard } from '@/components/blog/blog-card';
import { PageBlocks } from '@/components/cms/page-blocks';
import { ApiClientError, blogApi } from '@/lib/api-client';

export const revalidate = 60;

const getPost = cache(async (slug: string) => {
  try {
    return await blogApi.post(slug, { next: { revalidate: 60 } });
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 404) return null;
    throw e;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Post not found' };
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    openGraph: {
      type: 'article',
      publishedTime: post.publishedAt,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImageUrl ?? undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: post.authorName ? { '@type': 'Person', name: post.authorName } : undefined,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <Link href="/blog" className="text-sm text-brand-700 hover:underline">
          ← Blog
        </Link>
        {post.category ? (
          <p className="mt-4">
            <Link
              href={`/blog?category=${post.category.slug}`}
              className="text-xs font-semibold uppercase tracking-wide text-brand-700"
            >
              {post.category.name}
            </Link>
          </p>
        ) : null}
        <h1 className="mt-2 text-4xl font-bold leading-tight text-gray-900">{post.title}</h1>
        <p className="mt-3 text-sm text-gray-500">
          {post.authorName ? `${post.authorName} · ` : ''}
          {formatDate(post.publishedAt)} · {post.readingMinutes} min read
        </p>
        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt=""
            className="mt-8 w-full rounded-2xl border border-gray-200 object-cover"
          />
        ) : null}
        <div className="mt-8">
          <PageBlocks blocks={post.content.blocks} />
        </div>
        {post.tags.length > 0 ? (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <Link
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
              >
                #{t}
              </Link>
            ))}
          </div>
        ) : null}
      </article>

      {post.related.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold text-gray-900">More like this</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {post.related.map((r) => (
              <BlogCard key={r.slug} post={r} />
            ))}
          </div>
        </section>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </div>
  );
}
