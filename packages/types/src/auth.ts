import type { Role } from './enums';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  vendorId?: string;
  /** Device session id (see GET /auth/sessions). */
  sid?: string;
}

/** One signed-in device. */
export interface DeviceSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ---------------------------------------------------------------- account flows (Step 20)

export const PASSWORD_RESET_TTL_MINUTES = 30;
export const VERIFY_EMAIL_TTL_HOURS = 48;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 6;

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface OtpRequestInput {
  email: string;
}

export interface OtpVerifyInput {
  email: string;
  code: string;
}

/** Which sign-in methods the storefront should offer. */
export interface AuthProviders {
  google: boolean;
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface ChangePasswordInput {
  /** Not needed when the account has no password yet (signed up with Google / email code). */
  currentPassword?: string;
  newPassword: string;
}

export interface EmailPreferencesDto {
  marketing: boolean;
  productUpdates: boolean;
}

export interface DeleteAccountInput {
  /** Required when the account has a password. */
  password?: string;
  /** Must be the word DELETE. */
  confirm: string;
}
