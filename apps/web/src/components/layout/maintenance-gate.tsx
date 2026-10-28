import type { ReactNode } from 'react';
import { settingsApi } from '@/lib/api-client';

/** Shows a maintenance page while store.maintenanceMode is on (checked every 30 s). */
export async function MaintenanceGate({ children }: { children: ReactNode }) {
  const settings = await settingsApi.public({ next: { revalidate: 30 } }).catch(() => null);
  if (!settings?.maintenanceMode) return <>{children}</>;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <p className="text-5xl">🛠️</p>
        <h1 className="mt-4 text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
          {settings.name} will be back soon
        </h1>
        <p className="mt-2 text-gray-600">
          {settings.maintenanceMessage ?? "We're making some improvements."}
        </p>
        {settings.supportEmail ? (
          <p className="mt-4 text-sm text-gray-500">
            Questions?{' '}
            <a href={`mailto:${settings.supportEmail}`} className="text-brand-700 hover:underline">
              {settings.supportEmail}
            </a>
          </p>
        ) : null}
      </div>
    </main>
  );
}
