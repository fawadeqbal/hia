import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentGateway } from '@ecommerce/database';
import {
  PAYMENT_GATEWAYS,
  type GatewayDefinition,
  type GatewayStatus,
  type PaymentGatewayDto,
  type PaymentMethod,
} from '@ecommerce/types';
import { maskSecret, openJson, sealJson } from '../../common/utils/secret-box';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SaveGatewayDto } from './dto/payment-admin.dto';
import {
  DEV_WEBHOOK_SECRET,
  MockPaymentProvider,
  createPaymentProvider,
  type PaymentProvider,
} from './providers';
import { StripePaymentProvider } from './providers/stripe.provider';

type Credentials = Record<string, string>;

export interface ActiveGateway {
  provider: PaymentProvider;
  methods: PaymentMethod[];
}

const DEV_ENCRYPTION_KEY = 'dev-only-change-me-to-a-long-random-string';

/**
 * Online gateways configured in Admin → Settings → Payments.
 * Checkout uses the first enabled, usable gateway (by position). Webhooks and refunds go to the gateway that
 * took the payment, even after it was turned off, so in-flight payments still settle.
 * Credentials are stored encrypted (PAYMENT_ENCRYPTION_KEY) and never returned.
 */
@Injectable()
export class PaymentGatewaysService {
  private readonly logger = new Logger(PaymentGatewaysService.name);
  private readonly cache = new Map<string, { stamp: number; provider: PaymentProvider }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async active(): Promise<ActiveGateway | null> {
    const rows = await this.prisma.paymentGateway.findMany({
      where: { isEnabled: true },
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
    });
    if (rows.length === 0 && (await this.prisma.paymentGateway.count()) === 0) {
      // Database not seeded yet: fall back to the .env gateway.
      const legacy = createPaymentProvider(this.config);
      return legacy.enabled ? { provider: legacy, methods: legacy.methods } : null;
    }
    for (const row of rows) {
      const provider = this.providerFor(row);
      if (provider?.enabled) {
        const methods = provider.methods.filter((m) => row.methods.includes(m));
        if (methods.length) return { provider, methods };
      }
    }
    return null;
  }

  /** The gateway a payment was made with (enabled or not). */
  async byName(code: string): Promise<PaymentProvider | null> {
    const row = await this.prisma.paymentGateway.findUnique({ where: { code } });
    if (!row) {
      const legacy = createPaymentProvider(this.config);
      return legacy.name === code ? legacy : null;
    }
    return this.providerFor(row);
  }

  async list(): Promise<PaymentGatewayDto[]> {
    const rows = await this.prisma.paymentGateway.findMany();
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const activeCode = (await this.active())?.provider.name ?? null;
    return PAYMENT_GATEWAYS.map((def) =>
      this.toDto(def, byCode.get(def.code) ?? null, activeCode),
    ).sort((a, b) => a.position - b.position || a.code.localeCompare(b.code));
  }

  async save(code: string, dto: SaveGatewayDto, actorId?: string): Promise<PaymentGatewayDto> {
    const def = PAYMENT_GATEWAYS.find((g) => g.code === code);
    if (!def) throw new NotFoundException('Unknown payment gateway');
    const bad = dto.methods.filter((m) => !def.methods.includes(m));
    if (bad.length) throw new BadRequestException(`${def.name} does not support ${bad.join(', ')}`);
    if (dto.isEnabled && dto.methods.length === 0)
      throw new BadRequestException('Choose at least one payment method');
    if (dto.isEnabled && this.blocked(def))
      throw new BadRequestException(
        `${def.name} uses fake money and cannot be enabled in production`,
      );

    const existing = await this.prisma.paymentGateway.findUnique({ where: { code } });
    let credentials = existing?.credentials ?? null;
    const changedFields: string[] = [];
    if (dto.credentials && Object.keys(dto.credentials).length) {
      const allowed = new Set(def.fields.map((f) => f.key));
      const merged: Credentials = existing?.credentials ? this.open(existing.credentials) : {};
      for (const [key, value] of Object.entries(dto.credentials)) {
        if (!allowed.has(key)) throw new BadRequestException(`Unknown field "${key}"`);
        const v = String(value).trim();
        if (v) merged[key] = v;
        else delete merged[key];
        changedFields.push(key);
      }
      credentials = Object.keys(merged).length ? sealJson(merged, this.encryptionKey()) : null;
    }
    const data = {
      isEnabled: dto.isEnabled,
      isTestMode: dto.isTestMode,
      methods: dto.methods,
      position: dto.position,
      credentials,
    };
    const saved = await this.prisma.paymentGateway.upsert({
      where: { code },
      update: data,
      create: { code, ...data },
    });
    this.cache.delete(code);
    // Never log secret values: only which fields changed.
    await this.audit.log({
      actorId,
      action: 'payments.gateway.update',
      entityType: 'PaymentGateway',
      entityId: code,
      before: existing
        ? { isEnabled: existing.isEnabled, methods: existing.methods, position: existing.position }
        : null,
      after: {
        isEnabled: saved.isEnabled,
        methods: saved.methods,
        position: saved.position,
        credentialsChanged: changedFields,
      },
    });
    const activeCode = (await this.active())?.provider.name ?? null;
    return this.toDto(def, saved, activeCode);
  }

  // ---------------------------------------------------------------- internals
  private providerFor(row: PaymentGateway): PaymentProvider | null {
    const stamp = row.updatedAt.getTime();
    const hit = this.cache.get(row.code);
    if (hit && hit.stamp === stamp) return hit.provider;
    let creds: Credentials = {};
    try {
      creds = row.credentials ? this.open(row.credentials) : {};
    } catch (error) {
      this.logger.error(`Cannot decrypt credentials of ${row.code}: ${String(error)}`);
      return null;
    }
    const def = PAYMENT_GATEWAYS.find((g) => g.code === row.code);
    let provider: PaymentProvider | null = null;
    switch (row.code) {
      case 'mock':
        provider = new MockPaymentProvider({
          secret:
            creds.webhookSecret ||
            this.config.get<string>('PAYMENT_WEBHOOK_SECRET') ||
            DEV_WEBHOOK_SECRET,
          siteUrl: this.config.get<string>('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000',
          enabled: !def || !this.blocked(def),
        });
        break;
      case 'stripe':
        provider = new StripePaymentProvider({
          secretKey: creds.secretKey || this.config.get<string>('STRIPE_SECRET_KEY') || '',
          webhookSecret: creds.webhookSecret || this.config.get<string>('STRIPE_WEBHOOK_SECRET') || '',
        });
        break;
      default:
        this.logger.warn(`No provider implementation for gateway "${row.code}"`);
    }
    if (provider) this.cache.set(row.code, { stamp, provider });
    return provider;
  }

  private blocked(def: GatewayDefinition): boolean {
    return (
      Boolean(def.testOnly) &&
      this.config.get<string>('NODE_ENV') === 'production' &&
      this.config.get<string>('PAYMENT_ALLOW_MOCK_IN_PRODUCTION') !== 'true'
    );
  }

  private encryptionKey(): string {
    const key = this.config.get<string>('PAYMENT_ENCRYPTION_KEY');
    if (key) return key;
    if (this.config.get<string>('NODE_ENV') === 'production')
      throw new BadRequestException(
        'Set PAYMENT_ENCRYPTION_KEY on the server before saving gateway credentials',
      );
    return DEV_ENCRYPTION_KEY;
  }

  private open(sealed: string): Credentials {
    return openJson<Credentials>(sealed, this.encryptionKey());
  }

  private toDto(
    def: GatewayDefinition,
    row: PaymentGateway | null,
    activeCode: string | null,
  ): PaymentGatewayDto {
    let creds: Credentials = {};
    try {
      creds = row?.credentials ? this.open(row.credentials) : {};
    } catch {
      creds = {};
    }
    const status: GatewayStatus = this.blocked(def)
      ? 'BLOCKED'
      : !row?.isEnabled
        ? 'DISABLED'
        : activeCode === def.code
          ? 'ACTIVE'
          : 'STANDBY';
    const api = this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:4000';
    return {
      code: def.code,
      name: def.name,
      description: def.description,
      status,
      isEnabled: row?.isEnabled ?? false,
      isTestMode: row?.isTestMode ?? true,
      methods: (row?.methods ?? []) as PaymentMethod[],
      availableMethods: def.methods,
      position: row?.position ?? 0,
      fields: def.fields.map((f) => ({
        ...f,
        isSet: Boolean(creds[f.key]),
        preview: creds[f.key] ? (f.secret ? maskSecret(creds[f.key]!) : creds[f.key]!) : null,
      })),
      webhookUrl: `${api.replace(/\/$/, '')}/api/v1/payments/webhooks/${def.code}`,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }
}
