import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { openJson, sealJson } from '../../common/utils/secret-box';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { PaymentGatewaysService } from './gateways.service';

const KEY = 'test-key';
function setup(env: Record<string, string> = {}) {
  let row: Record<string, unknown> | null = null;
  const prisma = {
    paymentGateway: {
      findUnique: jest.fn(() => Promise.resolve(row)),
      findMany: jest.fn(() => Promise.resolve(row ? [row] : [])),
      count: jest.fn(() => Promise.resolve(row ? 1 : 0)),
      upsert: jest.fn(({ create, update }) => {
        row = { ...(row ?? create), ...(row ? update : {}), updatedAt: new Date() };
        return Promise.resolve(row);
      }),
    },
  };
  const audit = { log: jest.fn() };
  const config = { get: jest.fn((k: string) => ({ PAYMENT_ENCRYPTION_KEY: KEY, ...env })[k]) };
  const service = new PaymentGatewaysService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    audit as unknown as AuditService,
  );
  return { service, audit, row: () => row, setRow: (r: Record<string, unknown>) => (row = r) };
}

const body = { isEnabled: true, isTestMode: true, methods: ['CARD' as const], position: 0 };

describe('PaymentGatewaysService', () => {
  it('encrypts credentials, returns only a masked preview and never logs them', async () => {
    const { service, audit, row } = setup();
    const dto = await service.save('mock', {
      ...body,
      credentials: { webhookSecret: 'whsec_abcdef9876' },
    });
    const stored = row()!.credentials as string;
    expect(stored).not.toContain('whsec');
    expect(openJson(stored, KEY)).toEqual({ webhookSecret: 'whsec_abcdef9876' });
    expect(dto.fields[0]).toMatchObject({ isSet: true, preview: '••••9876' });
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('whsec');
  });

  it('keeps saved credentials when none are sent and clears a field sent empty', async () => {
    const { service, row, setRow } = setup();
    setRow({
      code: 'mock',
      ...body,
      methods: ['CARD'],
      credentials: sealJson({ webhookSecret: 'old-secret' }, KEY),
      updatedAt: new Date(),
    });
    await service.save('mock', body);
    expect(openJson(row()!.credentials as string, KEY)).toEqual({ webhookSecret: 'old-secret' });
    await service.save('mock', { ...body, credentials: { webhookSecret: '' } });
    expect(row()!.credentials).toBeNull();
  });

  it('rejects unsupported methods, unknown fields and enabling with no method', async () => {
    const { service } = setup();
    await expect(
      service.save('mock', { ...body, methods: ['COD'] as never }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.save('mock', { ...body, credentials: { apiKey: 'x' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.save('mock', { ...body, methods: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks the test gateway in production', async () => {
    const { service } = setup({ NODE_ENV: 'production' });
    await expect(service.save('mock', body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checkout uses an enabled gateway with only its allowed methods', async () => {
    const { service, setRow } = setup();
    setRow({
      code: 'mock',
      isEnabled: true,
      isTestMode: true,
      methods: ['WALLET'],
      position: 0,
      credentials: null,
      updatedAt: new Date(),
    });
    const active = await service.active();
    expect(active?.provider.name).toBe('mock');
    expect(active?.methods).toEqual(['WALLET']);
  });
});
