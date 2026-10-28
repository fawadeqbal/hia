import { BadRequestException } from '@nestjs/common';
import { SETTING_DEFINITIONS, validateSetting } from '@ecommerce/types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { SettingsService } from './settings.service';

const def = (key: string) => SETTING_DEFINITIONS.find((d) => d.key === key)!;

describe('settings', () => {
  it('validates values by type and range', () => {
    expect(validateSetting(def('store.maintenanceMode'), true)).toBeNull();
    expect(validateSetting(def('store.maintenanceMode'), 'yes')).not.toBeNull();
    expect(validateSetting(def('returns.windowDays'), 400)).not.toBeNull();
    expect(validateSetting(def('store.supportEmail'), 'not-an-email')).not.toBeNull();
  });

  it('saves only known, changed keys and audits them', async () => {
    const prisma = {
      setting: {
        findMany: jest.fn().mockResolvedValue([{ key: 'store.name', value: 'Old' }]),
        upsert: jest.fn(),
      },
    };
    const audit = { log: jest.fn() };
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
    await service.save({ 'store.name': 'New', 'evil.key': 'x' }, 'admin');
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.setting.upsert.mock.calls[0][0].where).toEqual({ key: 'store.name' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'settings.update' }));
  });

  it('rejects invalid values', async () => {
    const prisma = { setting: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() } };
    const service = new SettingsService(
      prisma as unknown as PrismaService,
      { log: jest.fn() } as unknown as AuditService,
    );
    await expect(service.save({ 'checkout.codFee': -5 }, 'admin')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });
});
