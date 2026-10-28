import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface LayoutProps {
  preview: string;
  children: React.ReactNode;
  /** Shown for marketing emails only. */
  unsubscribeUrl?: string;
}

const brand = {
  name: process.env.STORE_NAME ?? 'Ecommerce',
  logoUrl: process.env.EMAIL_LOGO_URL,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
};

export function Layout({ preview, children, unsubscribeUrl }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f4f5f7',
          fontFamily: 'Helvetica, Arial, sans-serif',
          margin: 0,
        }}
      >
        <Container
          style={{
            maxWidth: 600,
            margin: '24px auto',
            backgroundColor: '#ffffff',
            borderRadius: 12,
          }}
        >
          <Section style={{ padding: '24px 32px', borderBottom: '1px solid #eceef1' }}>
            {brand.logoUrl ? (
              <Img src={brand.logoUrl} alt={brand.name} height={32} />
            ) : (
              <Text style={{ fontSize: 20, fontWeight: 700, color: '#1d5ef1', margin: 0 }}>
                {brand.name}
              </Text>
            )}
          </Section>
          <Section style={{ padding: '24px 32px' }}>{children}</Section>
          <Hr style={{ borderColor: '#eceef1', margin: 0 }} />
          <Section style={{ padding: '16px 32px' }}>
            <Text style={{ fontSize: 12, color: '#8a909c', margin: 0 }}>
              © {new Date().getFullYear()} {brand.name} ·{' '}
              <Link href={brand.siteUrl} style={{ color: '#8a909c' }}>
                Visit store
              </Link>
              {unsubscribeUrl ? (
                <>
                  {' · '}
                  <Link href={unsubscribeUrl} style={{ color: '#8a909c' }}>
                    Unsubscribe
                  </Link>
                </>
              ) : null}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const styles = {
  heading: { fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 12px' },
  text: { fontSize: 15, lineHeight: '24px', color: '#374151', margin: '0 0 12px' },
  button: {
    backgroundColor: '#1d5ef1',
    color: '#ffffff',
    padding: '12px 20px',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 15,
    textDecoration: 'none',
    display: 'inline-block',
  },
  code: {
    fontSize: 28,
    letterSpacing: 6,
    fontWeight: 700,
    color: '#111827',
    backgroundColor: '#f4f5f7',
    padding: '12px 16px',
    borderRadius: 8,
    display: 'inline-block',
  },
} satisfies Record<string, React.CSSProperties>;
