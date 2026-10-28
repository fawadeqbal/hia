import { REWARD_TYPE_OPTIONS, rewardTypeLabel } from '@ecommerce/types';

describe('reward activity labels', () => {
  it('labels each kind of row', () => {
    expect(rewardTypeLabel('points', 'REDEEM')).toBe('Redeemed');
    expect(rewardTypeLabel('coupon', 'USED')).toBe('Used');
    expect(rewardTypeLabel('gift_card', 'REFUND')).toBe('Refunded');
    expect(rewardTypeLabel('gift_card', 'OTHER')).toBe('OTHER');
  });

  it('offers type filters for points and gift cards only', () => {
    expect(REWARD_TYPE_OPTIONS.points.map((o) => o.value)).toContain('EXPIRE');
    expect(REWARD_TYPE_OPTIONS.coupon).toEqual([]);
    expect(REWARD_TYPE_OPTIONS.gift_card).toHaveLength(4);
  });
});
