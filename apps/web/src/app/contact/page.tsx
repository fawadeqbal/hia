import type { Metadata } from 'next';
import { Suspense } from 'react';
import { container } from '@/components/layout/container';
import { ContactForm } from '@/components/support/contact-form';
import { WhatsAppIcon, whatsappHref } from '@/components/support/whatsapp-button';
import { getStoreSettings, storeName, storeTagline } from '@/lib/store-settings';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Chair repair requests, wholesale and institutional quotes, and questions.',
};

export default async function ContactPage() {
  const settings = await getStoreSettings();
  const name = storeName(settings);
  const lines: { label: string; value: string; href?: string }[] = [
    settings?.phone
      ? { label: 'Phone', value: settings.phone, href: `tel:${settings.phone.replace(/\s/g, '')}` }
      : null,
    settings?.supportEmail
      ? { label: 'Email', value: settings.supportEmail, href: `mailto:${settings.supportEmail}` }
      : null,
    settings?.address ? { label: 'Visit us', value: settings.address } : null,
  ].filter((l): l is { label: string; value: string; href?: string } => l !== null);

  return (
    <div className={`${container} grid gap-10 py-[clamp(32px,5vw,72px)] lg:grid-cols-[1fr_1.4fr]`}>
      <div className="flex flex-col gap-5">
        <p className="type-eyebrow text-brand-600">{name}</p>
        <h1 className="type-display text-[clamp(44px,6vw,84px)] text-gray-900">
          <span className="block">Talk to</span>
          <span className="block">us</span>
        </h1>
        <p className="max-w-[440px] text-[15px] text-gray-600">
          Need a part and not sure it fits? Want a chair repaired, or a quotation for your office,
          school or company? Send us a message — we usually reply the same working day.
        </p>
        <ul className="space-y-1.5 text-[14.5px] text-gray-700">
          <li>• Office chair parts & accessories</li>
          <li>• Office chairs & furniture</li>
          <li>• Chair repair & maintenance</li>
          <li>• Wholesale, retail & general order supplies</li>
          <li>• Institutional & corporate supplies</li>
        </ul>
        {settings?.whatsapp ? (
          <a
            href={whatsappHref(settings.whatsapp, `Hello ${name}, `)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center gap-2 self-start rounded-md bg-[#1f9d55] px-6 text-[12.5px] font-bold uppercase tracking-[0.1em] text-white hover:bg-[#178246] hover:text-white"
          >
            <WhatsAppIcon className="h-5 w-5" /> Chat on WhatsApp
          </a>
        ) : null}
        {lines.length > 0 ? (
          <dl className="space-y-3 border-t border-gray-200 pt-5">
            {lines.map((l) => (
              <div key={l.label}>
                <dt className="type-eyebrow text-gray-500">{l.label}</dt>
                <dd className="mt-1 whitespace-pre-line text-[15px] text-gray-900">
                  {l.href ? (
                    <a href={l.href} className="link-grow text-gray-900">
                      {l.value}
                    </a>
                  ) : (
                    l.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          {storeTagline(settings)}
        </p>
      </div>
      <Suspense>
        <ContactForm />
      </Suspense>
    </div>
  );
}
