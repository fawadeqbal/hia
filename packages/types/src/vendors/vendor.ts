import { VendorStatus } from '../enums';

export const VENDOR_STATUSES = Object.values(VendorStatus) as VendorStatus[];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

export interface VendorPolicies {
  shipping?: string;
  returns?: string;
}

export interface VendorPayoutDetails {
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  iban: string | null;
}

/** Store profile shown to the vendor and admins. */
export interface VendorDto {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  policies: VendorPolicies | null;
  status: VendorStatus;
  /** Why the vendor was rejected or suspended. */
  statusReason: string | null;
  /** The seller's own commission rule (scope VENDOR, no category), e.g. 10 = 10%. null = no seller rule. */
  commissionRate: number | null;
  ratingAverage: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /vendor/me — the signed-in vendor's own store. */
export interface VendorSelfDto extends VendorDto {
  payout: VendorPayoutDetails;
}

/** GET /admin/vendors/:id */
export interface VendorAdminDto extends VendorSelfDto {
  owner: { id: string; email: string; firstName: string; lastName: string };
  productCount: number;
  orderCount: number;
}

/** Row in GET /admin/vendors */
export interface VendorListItem {
  id: string;
  name: string;
  slug: string;
  email: string;
  logoUrl: string | null;
  status: VendorStatus;
  ownerName: string;
  productCount: number;
  createdAt: string;
}

/** GET /vendors/:slug — public storefront profile (approved vendors only). */
export interface VendorPublicDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  policies: VendorPolicies | null;
  ratingAverage: number;
  createdAt: string;
}

// ---------------------------------------------------------------- request bodies

export interface VendorApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  storeName: string;
  phone?: string;
  description?: string;
}

export interface VendorProfileInput {
  name?: string;
  phone?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  policies?: VendorPolicies;
}

export interface VendorPayoutInput {
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
  iban?: string | null;
}

export interface VendorApproveInput {
  commissionRate?: number;
}

export interface VendorReasonInput {
  reason: string;
}

export interface VendorAdminUpdateInput {
  commissionRate?: number | null;
}

export interface VendorListQuery {
  status?: VendorStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/** Profile completeness shown on the onboarding screen. */
export function vendorOnboardingChecklist(v: VendorSelfDto) {
  return [
    {
      key: 'logo',
      label: 'Upload a store logo',
      done: Boolean(v.logoUrl),
      href: '/settings/store',
    },
    {
      key: 'description',
      label: 'Describe your store',
      done: Boolean(v.description),
      href: '/settings/store',
    },
    {
      key: 'policies',
      label: 'Add shipping & return policies',
      done: Boolean(v.policies?.shipping && v.policies?.returns),
      href: '/settings/store',
    },
    {
      key: 'payout',
      label: 'Add payout bank details',
      done: Boolean(v.payout.bankAccountNumber),
      href: '/settings/payout',
    },
  ];
}
