import type { PublicStoreSettings, SettingsDto, SettingValue } from '@ecommerce/types';
import { api, type RequestOptions } from '../http';

export const settingsApi = {
  public: (options?: RequestOptions) => api<PublicStoreSettings>('/settings/public', options),
  get: () => api<SettingsDto>('/admin/settings'),
  save: (values: Record<string, SettingValue>) =>
    api<SettingsDto>('/admin/settings', { method: 'PUT', body: { values } }),
};
