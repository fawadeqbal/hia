import { Injectable, NotFoundException } from '@nestjs/common';
import type { TaxRate } from '@ecommerce/database';
import type { TaxClass, TaxRateDto } from '@ecommerce/types';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TaxRateDto as TaxRateBody } from './dto/localization.dto';
import type { TaxRateRow } from './tax-rules';

/** What checkout needs to compute tax. */
export interface CheckoutTaxContext {
  enabled: boolean;
  defaultCountry: string;
  rates: TaxRateRow[];
}

/** Tax rates by class + country / region. Percent in the API, fraction in the database. */
@Injectable()
export class TaxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<TaxRateDto[]> {
    const rows = await this.prisma.taxRate.findMany({
      orderBy: [{ countryCode: 'asc' }, { taxClass: 'asc' }, { region: 'asc' }],
    });
    return rows.map(toTaxRateDto);
  }

  async create(dto: TaxRateBody, actorId?: string): Promise<TaxRateDto> {
    const created = await this.prisma.taxRate.create({ data: toData(dto) });
    await this.audit.log({
      actorId,
      action: 'tax.rate.create',
      entityType: 'TaxRate',
      entityId: created.id,
      after: created,
    });
    return toTaxRateDto(created);
  }

  async update(id: string, dto: TaxRateBody, actorId?: string): Promise<TaxRateDto> {
    const before = await this.findOrThrow(id);
    const updated = await this.prisma.taxRate.update({ where: { id }, data: toData(dto) });
    await this.audit.log({
      actorId,
      action: 'tax.rate.update',
      entityType: 'TaxRate',
      entityId: id,
      before,
      after: updated,
    });
    return toTaxRateDto(updated);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const before = await this.findOrThrow(id);
    await this.prisma.taxRate.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'tax.rate.delete',
      entityType: 'TaxRate',
      entityId: id,
      before,
    });
  }

  async checkoutContext(): Promise<CheckoutTaxContext> {
    const [enabled, defaultCountry, rows] = await Promise.all([
      readSetting(this.prisma, 'tax.enabled', true),
      readSetting(this.prisma, 'tax.defaultCountry', 'PK'),
      this.prisma.taxRate.findMany({ where: { isActive: true } }),
    ]);
    return {
      enabled: Boolean(enabled),
      defaultCountry: String(defaultCountry || 'PK').toUpperCase(),
      rates: rows.map((r) => ({
        id: r.id,
        name: r.name,
        taxClass: r.taxClass,
        countryCode: r.countryCode,
        region: r.region,
        rate: Number(r.rate),
        isInclusive: r.isInclusive,
      })),
    };
  }

  private async findOrThrow(id: string): Promise<TaxRate> {
    const row = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Tax rate not found');
    return row;
  }
}

const toData = (dto: TaxRateBody) => ({
  name: dto.name,
  taxClass: dto.taxClass,
  countryCode: dto.countryCode,
  region: dto.region || null,
  rate: Math.round(dto.rate * 100) / 10000,
  isInclusive: dto.isInclusive,
  isActive: dto.isActive,
});

export function toTaxRateDto(r: TaxRate): TaxRateDto {
  return {
    id: r.id,
    name: r.name,
    taxClass: r.taxClass as TaxClass,
    countryCode: r.countryCode,
    region: r.region,
    rate: Math.round(Number(r.rate) * 1_000_000) / 10_000,
    isInclusive: r.isInclusive,
    isActive: r.isActive,
  };
}
