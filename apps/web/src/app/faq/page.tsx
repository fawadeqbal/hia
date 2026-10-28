import type { Metadata } from 'next';
import Link from 'next/link';
import type { PublicFaqGroup } from '@ecommerce/types';
import { cmsApi } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about orders, payments and returns.',
};
export const revalidate = 60;

async function getFaqs(): Promise<PublicFaqGroup[]> {
  try {
    return await cmsApi.faqs({ next: { revalidate: 60 } });
  } catch {
    return [];
  }
}

export default async function FaqPage() {
  const groups = await getFaqs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((g) =>
      g.items.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    ),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Frequently asked questions</h1>
      <p className="mt-2 text-gray-600">
        Can&apos;t find your answer? You can always{' '}
        <Link href="/track-order" className="text-brand-700 hover:underline">
          track your order
        </Link>{' '}
        or contact us.
      </p>

      {groups.length === 0 ? <p className="mt-8 text-gray-500">No questions yet.</p> : null}

      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <section key={g.category}>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">{g.category}</h2>
            <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
              {g.items.map((f) => (
                <details key={f.id} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-gray-900">
                    {f.question}
                    <span className="text-gray-400 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-gray-600">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      {groups.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      ) : null}
    </div>
  );
}
