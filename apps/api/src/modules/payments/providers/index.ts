import type { ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from './mock.provider';
import type { PaymentProvider } from './payment-provider';

export * from './payment-provider';
export { MockPaymentProvider } from './mock.provider';

export const DEV_WEBHOOK_SECRET = 'mock-webhook-secret-change-me';

/**
 * Picks the gateway from PAYMENT_PROVIDER. To add a real one: implement PaymentProvider in
 * `providers/<name>.provider.ts` and add a case here. Nothing else in the codebase changes.
 */
export function createPaymentProvider(config: ConfigService): PaymentProvider {
  const name = config.get<string>('PAYMENT_PROVIDER') || 'mock';
  const production = config.get<string>('NODE_ENV') === 'production';
  switch (name) {
    case 'mock':
      return new MockPaymentProvider({
        secret: config.get<string>('PAYMENT_WEBHOOK_SECRET') || DEV_WEBHOOK_SECRET,
        siteUrl: config.get<string>('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000',
        // Never let anyone "pay" with the mock gateway on a live store unless explicitly allowed (staging demos).
        enabled: !production || config.get<string>('PAYMENT_ALLOW_MOCK_IN_PRODUCTION') === 'true',
      });
    // case 'safepay':
    //   return new SafepayProvider({ apiKey: config.getOrThrow('PAYMENT_API_KEY'), … });
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  }
}
