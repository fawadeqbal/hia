import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import {
  SETTING_DEFINITIONS,
  validateSetting,
  type PublicStoreSettings,
  type SettingValue,
  type SettingsDto,
} from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const defaultFor = (type: string): SettingValue =>
  type === 'boolean' ? false : type === 'number' ? 0 : '';

/** Store settings editable in Admin → Settings (only keys in SETTING_DEFINITIONS). */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAll(): Promise<SettingsDto> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: SETTING_DEFINITIONS.map((d) => d.key) } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const values: Record<string, SettingValue> = {};
    for (const def of SETTING_DEFINITIONS) {
      const v = byKey.get(def.key);
      values[def.key] =
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
          ? v
          : defaultFor(def.type);
    }
    return { values };
  }

  async save(input: Record<string, unknown>, actorId: string): Promise<SettingsDto> {
    const before = (await this.getAll()).values;
    const changes: { key: string; group: string; value: SettingValue }[] = [];
    const errors: string[] = [];
    for (const def of SETTING_DEFINITIONS) {
      if (!(def.key in input)) continue;
      const raw = input[def.key];
      const value = typeof raw === 'string' && def.type !== 'text' ? raw.trim() : raw;
      const error = validateSetting(def, value);
      if (error) errors.push(error);
      else if (before[def.key] !== value)
        changes.push({ key: def.key, group: def.group, value: value as SettingValue });
    }
    if (errors.length > 0) throw new BadRequestException(errors.join('. '));

    for (const c of changes) {
      await this.prisma.setting.upsert({
        where: { key: c.key },
        update: { value: c.value as Prisma.InputJsonValue },
        create: { key: c.key, group: c.group, value: c.value as Prisma.InputJsonValue },
      });
    }
    if (changes.length > 0) {
      await this.audit.log({
        actorId,
        action: 'settings.update',
        entityType: 'Setting',
        before: Object.fromEntries(changes.map((c) => [c.key, before[c.key]])),
        after: Object.fromEntries(changes.map((c) => [c.key, c.value])),
      });
    }
    return this.getAll();
  }

  async publicSettings(): Promise<PublicStoreSettings> {
    const { values } = await this.getAll();
    const text = (k: string) =>
      typeof values[k] === 'string' && values[k] !== '' ? (values[k] as string) : null;
    return {
      name: text('store.name') ?? 'Store',
      logoUrl: text('store.logoUrl'),
      supportEmail: text('store.supportEmail'),
      phone: text('store.phone'),
      address: text('store.address'),
      maintenanceMode: values['store.maintenanceMode'] === true,
      maintenanceMessage: text('store.maintenanceMessage'),
    };
  }
}
