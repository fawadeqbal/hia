/**
 * Admin permissions are per AREA with two levels: view (GET requests) and manage (everything else).
 * The API maps every /admin/<segment>/… route to an area, so custom roles work on every admin endpoint
 * without per-controller code. Built-in roles keep their fixed access.
 */
export const ADMIN_AREAS = [
  { key: 'catalog', label: 'Catalog & products', routes: ['catalog', 'products'] },
  { key: 'orders', label: 'Orders & inquiries', routes: ['orders', 'inquiries'] },
  { key: 'returns', label: 'Returns', routes: ['returns'] },
  { key: 'customers', label: 'Customers', routes: ['customers'] },
  { key: 'vendors', label: 'Sellers & payouts', routes: ['vendors', 'payouts'] },
  { key: 'inventory', label: 'Inventory', routes: ['inventory'] },
  { key: 'shipping', label: 'Shipping', routes: ['shipping'] },
  { key: 'promotions', label: 'Promotions & gift cards', routes: ['promotions', 'gift-cards'] },
  { key: 'loyalty', label: 'Loyalty', routes: ['loyalty'] },
  { key: 'cms', label: 'Content', routes: ['cms'] },
  { key: 'marketing', label: 'Marketing & SEO', routes: ['marketing', 'seo'] },
  { key: 'reviews', label: 'Reviews & Q&A', routes: ['reviews', 'questions'] },
  { key: 'reports', label: 'Reports', routes: ['reports'] },
  {
    key: 'settings',
    label: 'Settings, roles & staff',
    routes: ['settings', 'roles', 'staff', 'audit-logs'],
  },
] as const;

export type AdminArea = (typeof ADMIN_AREAS)[number]['key'];
export type PermissionLevel = 'view' | 'manage';

export const permissionKey = (area: AdminArea, level: PermissionLevel) => `${area}.${level}`;
export const ALL_PERMISSION_KEYS: string[] = ADMIN_AREAS.flatMap((a) => [
  permissionKey(a.key, 'view'),
  permissionKey(a.key, 'manage'),
]);

/** "/api/v1/admin/orders/123" → "orders". Null for paths outside /admin or unknown segments. */
export function areaForAdminPath(path: string): AdminArea | null {
  const parts = path.split('?')[0]!.split('/').filter(Boolean);
  const i = parts.indexOf('admin');
  const segment = i >= 0 ? parts[i + 1] : undefined;
  if (!segment) return null;
  return ADMIN_AREAS.find((a) => (a.routes as readonly string[]).includes(segment))?.key ?? null;
}

export const levelForMethod = (method: string): PermissionLevel =>
  ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) ? 'view' : 'manage';

/** "manage" includes "view". */
export function hasAreaAccess(
  keys: Iterable<string>,
  area: AdminArea,
  level: PermissionLevel,
): boolean {
  const set = keys instanceof Set ? (keys as Set<string>) : new Set(keys);
  return (
    set.has(permissionKey(area, 'manage')) ||
    (level === 'view' && set.has(permissionKey(area, 'view')))
  );
}

/** Admin-app links → area (for hiding menu items the user can't open). "/" is always visible. */
export function areaForAdminHref(href: string): AdminArea | null {
  const path = href.split('?')[0]!;
  if (path === '/') return null;
  if (path.startsWith('/settings/shipping')) return 'shipping';
  if (path.startsWith('/support')) return 'reviews';
  if (path.startsWith('/seo')) return 'marketing';
  const first = path.split('/').filter(Boolean)[0] ?? '';
  return (
    ADMIN_AREAS.find((a) => a.key === first || (a.routes as readonly string[]).includes(first))
      ?.key ?? null
  );
}

/** Areas the built-in roles cover (they get "manage"). */
export const BUILT_IN_ROLE_AREAS: Record<string, readonly AdminArea[] | '*'> = {
  SUPER_ADMIN: '*',
  ADMIN: ADMIN_AREAS.map((a) => a.key).filter((k) => k !== 'settings'),
  CONTENT_MANAGER: ['cms'],
  MARKETING_MANAGER: ['promotions', 'loyalty', 'marketing', 'reports', 'customers'],
  SUPPORT_AGENT: ['orders', 'returns', 'customers', 'reviews'],
  WAREHOUSE_STAFF: ['inventory'],
};

/** Roles that are not staff (they never open the admin panel). */
export const NON_STAFF_ROLES = ['CUSTOMER', 'VENDOR', 'VENDOR_STAFF'];
export const ROLE_NAME_REGEX = /^[A-Z][A-Z0-9_]{2,39}$/;

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface RoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface StaffUserDto {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: { id: string; name: string }[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface InviteStaffInput {
  email: string;
  firstName: string;
  lastName: string;
  roleIds: string[];
}

export interface UpdateStaffRolesInput {
  roleIds: string[];
}

export interface AccessDto {
  userId: string;
  roles: string[];
  isSuperAdmin: boolean;
  /** Effective permission keys ("orders.manage", …). */
  permissions: string[];
}

// ---------------------------------------------------------------- audit log

export interface AuditLogQuery {
  action?: string;
  entityType?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; name: string; email: string } | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- seller staff

export const VENDOR_STAFF_PERMISSIONS = [
  'products',
  'inventory',
  'orders',
  'returns',
  'reviews',
  'coupons',
  'analytics',
  'finance',
] as const;
export type VendorStaffPermission = (typeof VENDOR_STAFF_PERMISSIONS)[number];
export const VENDOR_STAFF_PERMISSION_LABELS: Record<VendorStaffPermission, string> = {
  products: 'Products',
  inventory: 'Inventory & warehouses',
  orders: 'Orders & shipping',
  returns: 'Returns',
  reviews: 'Reviews & questions',
  coupons: 'Coupons',
  analytics: 'Analytics',
  finance: 'Earnings & payouts',
};

/**
 * What a seller-staff request needs. "any" = every staff member (reading the store profile),
 * "owner" = store owner only (profile, payout details, staff management).
 */
export function vendorAccessForPath(
  path: string,
  method: string,
): VendorStaffPermission | 'any' | 'owner' | null {
  const parts = path.split('?')[0]!.split('/').filter(Boolean);
  const i = parts.indexOf('vendor');
  const segment = i >= 0 ? parts[i + 1] : undefined;
  const read = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  switch (segment) {
    case 'products':
      return 'products';
    case 'inventory':
      return 'inventory';
    case 'orders':
    case 'shipping':
      return 'orders';
    case 'returns':
      return 'returns';
    case 'reviews':
    case 'questions':
      return 'reviews';
    case 'coupons':
      return 'coupons';
    case 'reports':
      return 'analytics';
    case 'payouts':
      return 'finance';
    case 'me':
      return read ? 'any' : 'owner';
    case 'staff':
      return read && parts[i + 2] === 'me' ? 'any' : 'owner';
    default:
      return null;
  }
}

/** Seller-app links → permission (null = everyone, "owner" = owner only). */
export function vendorAccessForHref(href: string): VendorStaffPermission | 'owner' | null {
  const first = href.split('?')[0]!.split('/').filter(Boolean)[0] ?? '';
  const map: Record<string, VendorStaffPermission | 'owner'> = {
    products: 'products',
    inventory: 'inventory',
    orders: 'orders',
    returns: 'returns',
    reviews: 'reviews',
    questions: 'reviews',
    coupons: 'coupons',
    analytics: 'analytics',
    finance: 'finance',
    settings: 'owner',
  };
  return map[first] ?? null;
}

export interface VendorStaffDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  permissions: VendorStaffPermission[];
  createdAt: string;
}

export interface InviteVendorStaffInput {
  email: string;
  firstName: string;
  lastName: string;
  permissions: VendorStaffPermission[];
}

export interface VendorStaffAccess {
  isOwner: boolean;
  permissions: VendorStaffPermission[];
}

// ---------------------------------------------------------------- store settings

export type SettingType = 'string' | 'text' | 'email' | 'url' | 'number' | 'boolean';

export interface SettingDefinition {
  key: string;
  group: string;
  label: string;
  type: SettingType;
  hint?: string;
  min?: number;
  max?: number;
}

export const SETTING_GROUP_LABELS: Record<string, string> = {
  general: 'Shop details',
  checkout: 'Checkout',
  shipping: 'Delivery',
  returns: 'Returns & reviews',
};

/**
 * Settings editable in Admin → Settings. Unknown keys are ignored by the API.
 * Single-shop build: only what a shop owner needs. Marketplace / loyalty / tax / marketing settings
 * still exist in the database with safe values (see the seed) but are not shown.
 */
export const SETTING_DEFINITIONS: SettingDefinition[] = [
  { key: 'store.name', group: 'general', label: 'Shop name', type: 'string' },
  {
    key: 'store.tagline',
    group: 'general',
    label: 'Motto / tagline',
    type: 'string',
    hint: 'Shown on the website, e.g. Quality Products | Competitive Prices | Reliable Service.',
  },
  {
    key: 'store.logoUrl',
    group: 'general',
    label: 'Logo URL',
    type: 'url',
    hint: 'Optional. Used in emails and the website header (the shop name is shown when empty).',
  },
  { key: 'store.phone', group: 'general', label: 'Phone', type: 'string' },
  {
    key: 'store.whatsapp',
    group: 'general',
    label: 'WhatsApp number',
    type: 'string',
    hint: 'With country code, e.g. 923001234567. Shows a WhatsApp chat button on the website.',
  },
  { key: 'store.supportEmail', group: 'general', label: 'Email', type: 'email' },
  { key: 'store.address', group: 'general', label: 'Shop address', type: 'text' },
  {
    key: 'store.maintenanceMode',
    group: 'general',
    label: 'Close the website for maintenance',
    type: 'boolean',
    hint: 'Visitors see a maintenance message and cannot order.',
  },
  { key: 'store.maintenanceMessage', group: 'general', label: 'Maintenance message', type: 'text' },
  {
    key: 'checkout.guestCheckout',
    group: 'checkout',
    label: 'Allow ordering without an account',
    type: 'boolean',
  },
  {
    key: 'checkout.codFee',
    group: 'checkout',
    label: 'Cash on delivery fee',
    type: 'number',
    min: 0,
    hint: 'Extra charge added to cash on delivery orders. 0 = no fee.',
  },
  {
    key: 'checkout.codMaxOrderTotal',
    group: 'checkout',
    label: 'Cash on delivery max order',
    type: 'number',
    min: 0,
    hint: '0 = no limit.',
  },
  {
    key: 'shipping.flatRatePerVendor',
    group: 'shipping',
    label: 'Default delivery charge',
    type: 'number',
    min: 0,
    hint: 'Used only when no delivery zone matches the address (zones: Settings → Delivery zones).',
  },
  {
    key: 'shipping.freeShippingAbove',
    group: 'shipping',
    label: 'Free delivery above',
    type: 'number',
    min: 0,
    hint: 'For the default delivery charge. 0 = never free.',
  },
  {
    key: 'returns.windowDays',
    group: 'returns',
    label: 'Return window (days)',
    type: 'number',
    min: 0,
    max: 365,
  },
  {
    key: 'reviews.requireApproval',
    group: 'returns',
    label: 'Approve reviews before publishing',
    type: 'boolean',
  },
  {
    key: 'questions.requireApproval',
    group: 'returns',
    label: 'Approve questions before publishing',
    type: 'boolean',
  },
];

export type SettingValue = string | number | boolean;

/** Validates one value against its definition; returns an error message or null. */
export function validateSetting(def: SettingDefinition, value: unknown): string | null {
  switch (def.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : `${def.label} must be yes or no`;
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        return `${def.label} must be a number`;
      if (def.min !== undefined && value < def.min)
        return `${def.label} must be at least ${def.min}`;
      if (def.max !== undefined && value > def.max)
        return `${def.label} must be at most ${def.max}`;
      return null;
    }
    case 'email':
      return typeof value === 'string' && (value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        ? null
        : `${def.label} must be an email`;
    case 'url':
      return typeof value === 'string' && (value === '' || /^https?:\/\/\S+$/.test(value))
        ? null
        : `${def.label} must be an http(s) URL`;
    default:
      return typeof value === 'string' && value.length <= 2000
        ? null
        : `${def.label} must be text up to 2000 characters`;
  }
}

export interface SettingsDto {
  values: Record<string, SettingValue>;
}

export interface PublicStoreSettings {
  name: string;
  /** Motto shown on the website (store.tagline). */
  tagline: string | null;
  logoUrl: string | null;
  /** WhatsApp number with country code, digits only (store.whatsapp). */
  whatsapp: string | null;
  supportEmail: string | null;
  phone: string | null;
  address: string | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}
