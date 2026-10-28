import type {
  AdjustGiftCardInput,
  AdjustPointsInput,
  GiftCardBalanceDto,
  GiftCardDto,
  IssueGiftCardInput,
  LoyaltyMemberDto,
  LoyaltySummaryDto,
  TierDto,
  UpdateTierInput,
} from '@ecommerce/types';
import { api } from '../http';

export const loyaltyApi = {
  // ---- customer ----
  summary: () => api<LoyaltySummaryDto>('/loyalty'),
  giftCardBalance: (code: string) =>
    api<GiftCardBalanceDto>(`/gift-cards/${encodeURIComponent(code)}/balance`),

  // ---- admin ----
  tiers: () => api<TierDto[]>('/admin/loyalty/tiers'),
  updateTier: (id: string, body: UpdateTierInput) =>
    api<TierDto>(`/admin/loyalty/tiers/${id}`, { method: 'PATCH', body }),
  member: (email: string) =>
    api<LoyaltyMemberDto>(`/admin/loyalty/members?email=${encodeURIComponent(email)}`),
  adjustPoints: (userId: string, body: AdjustPointsInput) =>
    api<LoyaltyMemberDto>(`/admin/loyalty/members/${userId}/adjust`, { method: 'POST', body }),
  giftCards: () => api<GiftCardDto[]>('/admin/gift-cards'),
  giftCard: (id: string) => api<GiftCardDto>(`/admin/gift-cards/${id}`),
  issueGiftCard: (body: IssueGiftCardInput) =>
    api<GiftCardDto>('/admin/gift-cards', { method: 'POST', body }),
  adjustGiftCard: (id: string, body: AdjustGiftCardInput) =>
    api<GiftCardDto>(`/admin/gift-cards/${id}/adjust`, { method: 'POST', body }),
  setGiftCardActive: (id: string, isActive: boolean) =>
    api<GiftCardDto>(`/admin/gift-cards/${id}`, { method: 'PATCH', body: { isActive } }),
};
