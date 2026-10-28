import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters').max(128),
  /** From a friend's referral link (?ref=CODE). */
  referralCode: z.string().trim().max(20).optional(),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------- Step 20

const passwordField = z.string().min(8, 'At least 8 characters').max(128, 'At most 128 characters');

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const otpRequestSchema = z.object({ email: z.string().trim().email('Enter a valid email') });
export type OtpRequestFormValues = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type OtpVerifyFormValues = z.infer<typeof otpVerifySchema>;

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === '' || /^[+0-9 ()-]{7,20}$/.test(v), 'Digits, spaces, + ( ) - only'),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    hasPassword: z.boolean(),
    currentPassword: z.string(),
    newPassword: passwordField,
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.hasPassword && v.currentPassword === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentPassword'],
        message: 'Enter your current password',
      });
    }
    if (v.newPassword !== v.confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm'],
        message: 'Passwords do not match',
      });
    }
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z
  .object({ hasPassword: z.boolean(), password: z.string(), confirm: z.string() })
  .superRefine((v, ctx) => {
    if (v.hasPassword && v.password === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Enter your password',
      });
    }
    if (v.confirm !== 'DELETE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm'],
        message: 'Type DELETE to confirm',
      });
    }
  });
export type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;
