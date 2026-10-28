import Link from 'next/link';
import { whatsappHref } from '@/components/support/whatsapp-button';
import { getMenu } from '@/lib/cms';
import { getStoreSettings, storeName, storeTagline } from '@/lib/store-settings';
import { container } from './container';
import { StoreLogo } from './store-logo';

/** Used until the footer menu is set up in Admin → Website → Menus. */
const fallbackGroups = [
  {
    title: 'Shop',
    links: [
      ['Chair parts', '/categories/chair-parts'],
      ['Office chairs', '/categories/office-chairs'],
      ['All products', '/products'],
      ['Track order', '/track-order'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['Contact us', '/contact'],
      ['FAQ', '/faq'],
      ['Delivery policy', '/pages/shipping-policy'],
      ['Return policy', '/pages/return-policy'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About us', '/pages/about'],
      ['Products & services', '/pages/services'],
      ['Terms', '/pages/terms'],
      ['Privacy', '/pages/privacy'],
    ],
  },
] as const;

/** Ink footer: contact block + link columns, then a giant wordmark and the legal row. */
export async function SiteFooter() {
  const [menu, settings] = await Promise.all([getMenu('footer'), getStoreSettings()]);
  const name = storeName(settings);
  const tagline = storeTagline(settings);
  const groups: { title: string; links: (readonly [string, string])[] }[] =
    menu.length > 0
      ? menu.map((col) => ({
          title: col.label,
          links: (col.children.length > 0
            ? col.children
            : [{ label: col.label, url: col.url }]
          ).map((l): readonly [string, string] => [l.label, l.url]),
        }))
      : fallbackGroups.map((g) => ({ title: g.title, links: [...g.links] }));

  const contact: { label: string; value: string; href?: string }[] = [
    settings?.phone
      ? { label: 'Phone', value: settings.phone, href: `tel:${settings.phone.replace(/\s/g, '')}` }
      : null,
    settings?.whatsapp
      ? { label: 'WhatsApp', value: `+${settings.whatsapp}`, href: whatsappHref(settings.whatsapp) }
      : null,
    settings?.supportEmail
      ? { label: 'Email', value: settings.supportEmail, href: `mailto:${settings.supportEmail}` }
      : null,
    settings?.address ? { label: 'Visit us', value: settings.address } : null,
  ].filter((c): c is { label: string; value: string; href?: string } => c !== null);

  return (
    <footer className="mt-[clamp(64px,8vw,120px)] overflow-hidden bg-gray-900 text-gray-300">
      <div
        className={`${container} grid gap-12 pb-12 pt-[clamp(48px,6vw,88px)] lg:grid-cols-[1.2fr_1fr]`}
      >
        <div className="flex flex-col gap-5">
          <h2 className="type-display text-[clamp(40px,5vw,72px)] text-gray-50">
            <span className="block">Need a part</span>
            <span className="block text-gray-500">or a repair?</span>
          </h2>
          <p className="max-w-[460px] text-[15px] text-white/65">
            Send us a photo of your chair and we will tell you exactly which part it needs — or book
            a repair. Bulk and institutional orders welcome.
          </p>
          {contact.length > 0 ? (
            <dl className="grid max-w-[520px] gap-x-8 gap-y-3 sm:grid-cols-2">
              {contact.map((c) => (
                <div key={c.label}>
                  <dt className="type-eyebrow text-white/45">{c.label}</dt>
                  <dd className="mt-1 whitespace-pre-line text-[14.5px] text-gray-100">
                    {c.href ? (
                      <a
                        href={c.href}
                        className="link-grow text-gray-100 hover:text-white"
                        {...(c.href.startsWith('http')
                          ? { target: '_blank', rel: 'noreferrer' }
                          : {})}
                      >
                        {c.value}
                      </a>
                    ) : (
                      c.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <Link
            href="/contact"
            className="inline-flex h-12 items-center gap-2 self-start rounded-md bg-white px-6 text-[12.5px] font-bold uppercase tracking-[0.1em] text-gray-900 hover:bg-brand-600 hover:text-white"
          >
            Contact us <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-3">
              <p className="type-eyebrow mb-1 text-white/45">{g.title}</p>
              {g.links.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="link-grow self-start text-[14.5px] text-gray-200 hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Giant wordmark (first word of the name), cropped by the bottom edge. */}
      <div className={container} aria-hidden>
        <p className="type-display -mb-[0.14em] select-none text-center text-[clamp(96px,24vw,360px)] leading-[0.8] text-white/[.06]">
          {name.split(/\s+/)[0]}
        </p>
      </div>

      <div className="border-t border-white/10">
        <div
          className={`${container} flex flex-wrap items-center justify-between gap-4 py-5 text-[12.5px] text-white/50`}
        >
          <StoreLogo name={name} tone="light" href={null} />
          <p>
            © {new Date().getFullYear()} {name}. {tagline}
          </p>
          <div className="flex gap-5">
            <Link href="/pages/terms" className="link-grow text-white/50 hover:text-white">
              Terms
            </Link>
            <Link href="/pages/privacy" className="link-grow text-white/50 hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
