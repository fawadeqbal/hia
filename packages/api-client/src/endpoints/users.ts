import type {
  ChangePasswordInput,
  DeleteAccountInput,
  EmailPreferencesDto,
  ProfileInput,
  Role,
} from '@ecommerce/types';
import { api } from '../http';

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  roles: Role[];
  /** False for accounts created with Google or an email code. */
  hasPassword: boolean;
  googleLinked: boolean;
}

export const usersApi = {
  me: () => api<CurrentUser>('/users/me'),
  updateProfile: (body: ProfileInput) => api<CurrentUser>('/users/me', { method: 'PATCH', body }),
  changePassword: (body: ChangePasswordInput) =>
    api<void>('/users/me/password', { method: 'POST', body }),
  emailPreferences: () => api<EmailPreferencesDto>('/users/me/email-preferences'),
  saveEmailPreferences: (body: EmailPreferencesDto) =>
    api<EmailPreferencesDto>('/users/me/email-preferences', { method: 'PUT', body }),
  deleteAccount: (body: DeleteAccountInput) =>
    api<void>('/users/me/delete', { method: 'POST', body }),
};
