import { getStoreSettings } from '@/lib/store-settings';

/** WhatsApp chat link for a number in admin settings (digits only, with country code). */
export const whatsappHref = (number: string, text?: string) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/**
 * Floating "Chat on WhatsApp" button. Shown only when a WhatsApp number is set in
 * Admin → Settings → Shop settings. Sits above the phone tab bar and the sticky add-to-cart bar.
 */
export async function WhatsAppButton() {
  const settings = await getStoreSettings();
  if (!settings?.whatsapp) return null;
  return (
    <a
      href={whatsappHref(settings.whatsapp, `Hello ${settings.name}, `)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-[88px] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-[#1f9d55] pl-4 pr-4 text-sm font-bold text-white shadow-[0_14px_30px_-12px_rgba(23,21,19,.6)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#178246] hover:text-white md:bottom-6 md:right-6 md:pr-5 [html[data-sticky-cta]_&]:bottom-[96px] md:[html[data-sticky-cta]_&]:bottom-[96px]"
    >
      <WhatsAppIcon className="h-6 w-6" />
      <span className="hidden md:inline">Chat on WhatsApp</span>
    </a>
  );
}
