import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { Suspense, type ReactNode } from 'react';
import { Providers } from './providers';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { WhatsAppButton } from '@/components/support/whatsapp-button';
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
  title: {
    default: 'HIA Furniture Solutions — Office chair parts, chairs & repair',
    template: '%s | HIA Furniture Solutions',
  },
  description:
    'Office chair spare parts (gas lifts, wheels, bases, armrests, tilt mechanisms), office chairs, furniture, general order supplies, and chair repair & maintenance. Quality Products | Competitive Prices | Reliable Service.',
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
                  <WhatsAppButton />
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
