import type {
  AuthProviders,
  AuthTokens,
  DeviceSession,
  ForgotPasswordInput,
  LoginFormValues,
  OtpRequestInput,
  OtpVerifyInput,
  RegisterFormValues,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@ecommerce/types';
import { API_URL, api } from '../http';

export const authApi = {
  login: (body: LoginFormValues) => api<AuthTokens>('/auth/login', { method: 'POST', body }),
  register: (body: RegisterFormValues) =>
    api<AuthTokens>('/auth/register', { method: 'POST', body }),
  refresh: () => api<AuthTokens>('/auth/refresh', { method: 'POST', body: {} }),
  logout: () => api<void>('/auth/logout', { method: 'POST', body: {} }),
  sessions: () => api<DeviceSession[]>('/auth/sessions'),
  revokeSession: (id: string) =>
    api<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  revokeOtherSessions: () => api<void>('/auth/sessions', { method: 'DELETE' }),

  providers: () => api<AuthProviders>('/auth/providers'),
  forgotPassword: (body: ForgotPasswordInput) =>
    api<void>('/auth/forgot-password', { method: 'POST', body }),
  resetPassword: (body: ResetPasswordInput) =>
    api<void>('/auth/reset-password', { method: 'POST', body }),
  verifyEmail: (body: VerifyEmailInput) =>
    api<void>('/auth/verify-email', { method: 'POST', body }),
  /** Signed-in user: send the verification email again. */
  resendVerification: () => api<void>('/auth/verify-email/resend', { method: 'POST', body: {} }),
  requestOtp: (body: OtpRequestInput) => api<void>('/auth/otp/request', { method: 'POST', body }),
  verifyOtp: (body: OtpVerifyInput) =>
    api<AuthTokens>('/auth/otp/verify', { method: 'POST', body }),
  /** Full-page redirect target for "Continue with Google". */
  googleUrl: (next = '/') => `${API_URL}/auth/google?next=${encodeURIComponent(next)}`,
};
