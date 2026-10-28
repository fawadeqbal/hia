import type {
  AccessDto,
  AuditLogItem,
  AuditLogQuery,
  InviteStaffInput,
  InviteVendorStaffInput,
  Paginated,
  PublicStoreSettings,
  RoleDto,
  RoleInput,
  SettingsDto,
  SettingValue,
  StaffUserDto,
  UpdateStaffRolesInput,
  VendorStaffAccess,
  VendorStaffDto,
  VendorStaffPermission,
} from '@ecommerce/types';
import { api, type RequestOptions } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const rbacApi = {
  myAccess: () => api<AccessDto>('/rbac/me'),
  roles: () => api<RoleDto[]>('/admin/roles'),
  createRole: (body: RoleInput) => api<RoleDto>('/admin/roles', { method: 'POST', body }),
  updateRole: (id: string, body: Partial<RoleInput>) =>
    api<RoleDto>(`/admin/roles/${id}`, { method: 'PATCH', body }),
  removeRole: (id: string) => api<void>(`/admin/roles/${id}`, { method: 'DELETE' }),
  staff: () => api<StaffUserDto[]>('/admin/staff'),
  inviteStaff: (body: InviteStaffInput) =>
    api<StaffUserDto>('/admin/staff', { method: 'POST', body }),
  updateStaffRoles: (id: string, body: UpdateStaffRolesInput) =>
    api<StaffUserDto>(`/admin/staff/${id}/roles`, { method: 'PUT', body }),
  setStaffActive: (id: string, active: boolean) =>
    api<StaffUserDto>(`/admin/staff/${id}/${active ? 'activate' : 'deactivate'}`, {
      method: 'POST',
      body: {},
    }),
  auditLogs: (q: AuditLogQuery = {}) =>
    api<Paginated<AuditLogItem>>(`/admin/audit-logs${toQuery(q)}`),
};

export const settingsApi = {
  public: (options?: RequestOptions) => api<PublicStoreSettings>('/settings/public', options),
  get: () => api<SettingsDto>('/admin/settings'),
  save: (values: Record<string, SettingValue>) =>
    api<SettingsDto>('/admin/settings', { method: 'PUT', body: { values } }),
};

export const vendorStaffApi = {
  me: () => api<VendorStaffAccess>('/vendor/staff/me'),
  list: () => api<VendorStaffDto[]>('/vendor/staff'),
  invite: (body: InviteVendorStaffInput) =>
    api<VendorStaffDto>('/vendor/staff', { method: 'POST', body }),
  update: (id: string, permissions: VendorStaffPermission[]) =>
    api<VendorStaffDto>(`/vendor/staff/${id}`, { method: 'PATCH', body: { permissions } }),
  remove: (id: string) => api<void>(`/vendor/staff/${id}`, { method: 'DELETE' }),
};
