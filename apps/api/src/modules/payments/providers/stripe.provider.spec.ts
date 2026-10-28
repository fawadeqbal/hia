import Stripe from 'stripe';
import { StripePaymentProvider, fromMinor, toMinor } from './stripe.provider';

const secret = 'whsec_test_secret';
const provider = new StripePaymentProvider({ secretKey: 'sk_test_x', webhookSecret: secret });

function signed(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({
    id: `evt_${type}`,
    object: 'event',
    type,
    livemode: false,
    data: { object },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { headers: { 'stripe-signature': header }, raw: Buffer.from(payload) };
}

describe('StripePaymentProvider', () => {
  it('converts amounts to minor units', () => {
    expect(toMinor(10.5, 'usd')).toBe(1050);
    expect(toMinor(500, 'JPY')).toBe(500);
    expect(fromMinor(1999, 'PKR')).toBe(19.99);
  });

  it('is enabled only with both keys', () => {
    expect(provider.enabled).toBe(true);
    expect(new StripePaymentProvider({ secretKey: 'sk_test_x', webhookSecret: '' }).enabled).toBe(
      false,
    );
  });

  it('maps a paid checkout session', () => {
    const { headers, raw } = signed('checkout.session.completed', {
      id: 'cs_1',
      payment_status: 'paid',
      amount_total: 12345,
      currency: 'usd',
    });
    expect(provider.parseWebhook(headers, raw)).toMatchObject({
      providerRef: 'cs_1',
      outcome: 'PAID',
      amount: 123.45,
    });
  });

  it('maps expired / failed sessions and ignores other events', () => {
    const exp = signed('checkout.session.expired', {
      id: 'cs_2',
      amount_total: 100,
      currency: 'usd',
    });
    expect(provider.parseWebhook(exp.headers, exp.raw).outcome).toBe('CANCELLED');
    const fail = signed('checkout.session.async_payment_failed', {
      id: 'cs_3',
      amount_total: 100,
      currency: 'usd',
    });
    expect(provider.parseWebhook(fail.headers, fail.raw).outcome).toBe('FAILED');
    const other = signed('payment_intent.created', { id: 'pi_1' });
    expect(provider.parseWebhook(other.headers, other.raw).outcome).toBeNull();
  });

  it('rejects a bad signature', () => {
    const { raw } = signed('checkout.session.completed', { id: 'cs_1' });
    expect(() => provider.parseWebhook({ 'stripe-signature': 't=1,v1=bad' }, raw)).toThrow();
  });
});
