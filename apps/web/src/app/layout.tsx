import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { Suspense, type ReactNode } from 'react';
import { Providers } from './providers';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { SupportWidget } from '@/components/support/support-widget';
import { OrganizationJsonLd } from '@/components/seo/organization-json-ld';
import { MaintenanceGate } from '@/components/layout/maintenance-gate';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { StoreChrome } from '@/components/layout/store-chrome';
import { NavigationProgress } from '@/components/layout/navigation-progress';
import './globals.css';

// Archivo with its width axis: regular for text, condensed (font-stretch) for display type.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  axes: ['wdth'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'KADAM — Footwear for every step', template: '%s | KADAM' },
  description: 'Sneakers, formal shoes, sandals and more — made for every step.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="flex min-h-screen flex-col">
        <MaintenanceGate>
          <Providers>
            <OrganizationJsonLd />
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            <StoreChrome
              header={<SiteHeader />}
              footer={<SiteFooter />}
              extras={
                <>
                  <MobileTabBar />
                  <CartDrawer />
                  <SupportWidget />
                </>
              }
            >
              {children}
            </StoreChrome>
          </Providers>
        </MaintenanceGate>
      </body>
    </html>
  );
}
