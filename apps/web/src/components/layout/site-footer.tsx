import Link from 'next/link';
import { NewsletterSignup } from '@/components/marketing/newsletter-signup';
import { getMenu } from '@/lib/cms';
import { getStoreSettings, storeName } from '@/lib/store-settings';
import { container } from './container';
import { StoreLogo } from './store-logo';

/** Used until the footer menu is set up in Admin → Content → Menus. */
const fallbackGroups = [
  {
    title: 'Shop',
    links: [
      ['New in', '/products?sort=newest'],
      ['Best sellers', '/products?sort=popular'],
      ['Sale', '/products?onSale=true'],
      ['All products', '/products'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['Track order', '/track-order'],
      ['FAQ', '/faq'],
      ['Shipping', '/pages/shipping-policy'],
      ['Returns & exchanges', '/pages/return-policy'],
      ['Contact us', '/contact'],
    ],
  },
  {
    title: 'KADAM',
    links: [
      ['About', '/pages/about'],
      ['Journal', '/blog'],
      ['Sell with us', process.env.NEXT_PUBLIC_VENDOR_URL || 'http://localhost:3002'],
      ['Rewards', '/account/loyalty'],
    ],
  },
] as const;

/** Ink footer: newsletter + link columns, then a giant wordmark and the legal row. */
export async function SiteFooter() {
  const [menu, settings] = await Promise.all([getMenu('footer'), getStoreSettings()]);
  const name = storeName(settings);
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
  return (
    <footer className="mt-[clamp(64px,8vw,120px)] overflow-hidden bg-gray-900 text-gray-300">
      <div
        className={`${container} grid gap-12 pb-12 pt-[clamp(48px,6vw,88px)] lg:grid-cols-[1.2fr_1fr]`}
      >
        <NewsletterSignup />
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

      {/* Giant wordmark, cropped by the bottom edge. */}
      <div className={container} aria-hidden>
        <p className="type-display -mb-[0.14em] select-none text-center text-[clamp(96px,24vw,360px)] leading-[0.8] text-white/[.06]">
          {name}
        </p>
      </div>

      <div className="border-t border-white/10">
        <div
          className={`${container} flex flex-wrap items-center justify-between gap-4 py-5 text-[12.5px] text-white/50`}
        >
          <StoreLogo
            name={name}
            tone="light"
            href={null}
            className="[&_.type-display]:text-[22px]"
          />
          <p>
            © {new Date().getFullYear()} {name}. Footwear for every step.
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
