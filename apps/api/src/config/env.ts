import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_ADMIN_URL: z.string().default('http://localhost:3001'),
  NEXT_PUBLIC_VENDOR_URL: z.string().default('http://localhost:3002'),

  // Google sign-in (optional). Redirect URI: <API_PUBLIC_URL>/api/v1/auth/google/callback
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Payments: "mock" until a real gateway adapter is added (see modules/payments/providers)
  PAYMENT_PROVIDER: z.string().default('mock'),
  PAYMENT_API_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Support assistant (services/support-ai). Internal service: only this API calls it, with the shared key.
  SUPPORT_AI_URL: z.string().default('http://localhost:5000'),
  SUPPORT_AI_KEY: z.string().default('dev-support-ai-key-change-me'),
  PAYMENT_ALLOW_MOCK_IN_PRODUCTION: z.enum(['true', 'false']).default('false'),

  // Object storage (MinIO locally, any S3-compatible service in production)
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('ecommerce-media'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),
  S3_AUTO_CREATE_BUCKET: z.enum(['true', 'false']).default('true'),
  CDN_URL: z.string().default('http://localhost:9000/ecommerce-media'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env & Record<string, unknown> {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return { ...config, ...parsed.data };
}
