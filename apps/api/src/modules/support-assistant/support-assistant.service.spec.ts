import { customerVisitorId } from './support-assistant.service';

describe('customerVisitorId', () => {
  it('is a stable, valid UUID per customer', () => {
    const a = customerVisitorId('user_1');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(customerVisitorId('user_1')).toBe(a);
    expect(customerVisitorId('user_2')).not.toBe(a);
  });
});
