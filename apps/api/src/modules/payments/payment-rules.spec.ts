import {
  amountsMatch,
  paymentDeadline,
  refundStatusFor,
  refundableAmount,
  signPayload,
  verifySignature,
} from './payment-rules';

describe('payment rules', () => {
  it('verifies only the exact signed body', () => {
    const sig = signPayload('{"a":1}', 'secret');
    expect(verifySignature('{"a":1}', sig, 'secret')).toBe(true);
    expect(verifySignature('{"a":2}', sig, 'secret')).toBe(false);
    expect(verifySignature('{"a":1}', sig, 'other')).toBe(false);
    expect(verifySignature('{"a":1}', 'short', 'secret')).toBe(false);
  });

  it('computes the payment deadline', () => {
    expect(paymentDeadline(new Date('2026-01-01T10:00:00Z'), 15).toISOString()).toBe(
      '2026-01-01T10:15:00.000Z',
    );
  });

  it('compares money in cents', () => {
    expect(amountsMatch(0.1 + 0.2, 0.3)).toBe(true);
    expect(amountsMatch(10, 10.01)).toBe(false);
  });

  it('tracks refund status and what is left to refund', () => {
    expect(refundStatusFor(100, 0)).toBe('PAID');
    expect(refundStatusFor(100, 40)).toBe('PARTIALLY_REFUNDED');
    expect(refundStatusFor(100, 100)).toBe('REFUNDED');
    expect(refundableAmount(100, 40.5)).toBe(59.5);
    expect(refundableAmount(100, 120)).toBe(0);
  });
});
