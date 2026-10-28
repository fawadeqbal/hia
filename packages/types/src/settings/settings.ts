// Shop settings (Admin → Shop settings) and the public settings the website reads.

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
