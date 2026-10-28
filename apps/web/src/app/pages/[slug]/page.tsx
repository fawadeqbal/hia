import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { formatDate } from '@ecommerce/ui';
import { PageBlocks } from '@/components/cms/page-blocks';
import { ApiClientError, cmsApi } from '@/lib/api-client';

export const revalidate = 60;

const getPage = cache(async (slug: string) => {
  try {
    return await cmsApi.page(slug, { next: { revalidate: 60 } });
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
  const page = await getPage(slug);
  if (!page) return { title: 'Page not found' };
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined };
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">{page.title}</h1>
      <p className="mb-8 mt-2 text-sm text-gray-500">Last updated {formatDate(page.updatedAt)}</p>
      <PageBlocks blocks={page.content.blocks} />
    </article>
  );
}
