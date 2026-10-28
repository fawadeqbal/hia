import type { Metadata } from 'next';
import { EmailLinkAction } from '@/components/marketing/email-link-action';

export const metadata: Metadata = { title: 'Confirm subscription', robots: { index: false } };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
        Confirm subscription
      </h1>
      <EmailLinkAction kind="confirm" email={one(q.email)} sig={one(q.sig)} />
    </div>
  );
}
