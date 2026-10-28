import { settingsApi } from '@/lib/api-client';
import { JsonLd } from './json-ld';

/** Organization + WebSite (with site search) on every page. */
export async function OrganizationJsonLd() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const s = await settingsApi.public({ next: { revalidate: 3600 } }).catch(() => null);
  const name = s?.name || 'Ecommerce';
  return (
    <JsonLd
      data={[
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name,
          url: site,
          ...(s?.logoUrl ? { logo: s.logoUrl } : {}),
          ...(s?.supportEmail || s?.phone
            ? {
                contactPoint: {
                  '@type': 'ContactPoint',
                  contactType: 'customer service',
                  email: s?.supportEmail ?? undefined,
                  telephone: s?.phone ?? undefined,
                },
              }
            : {}),
          ...(s?.address ? { address: s.address } : {}),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name,
          url: site,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${site}/search?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
      ]}
    />
  );
}
