import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import type { ShippingRateInput, ShippingZoneDto } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateZoneDto, UpdateZoneDto } from './dto/shipping.dto';
import { toZoneDto, zoneInclude, type ZoneRow } from './shipping.mapper';

type Tx = Prisma.TransactionClient;

const rateData = (r: ShippingRateInput) => ({
  name: r.name,
  type: r.type,
  courierId: r.courierId || null,
  price: r.type === 'FREE' ? 0 : r.price,
  minWeightGrams: r.minWeightGrams ?? null,
  maxWeightGrams: r.maxWeightGrams ?? null,
  minOrderTotal: r.minOrderTotal ?? null,
  maxOrderTotal: r.maxOrderTotal ?? null,
  freeAbove: r.freeAbove ?? null,
  codAvailable: r.codAvailable,
  codFee: r.codFee,
  estimatedDays: r.estimatedDays || null,
  isActive: r.isActive,
});

/** Admin: shipping zones with their rates (rates are edited as a nested list, synced in one transaction). */
@Injectable()
export class ShippingZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<ShippingZoneDto[]> {
    const rows = await this.prisma.shippingZone.findMany({
      include: zoneInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(toZoneDto);
  }

  async get(id: string): Promise<ShippingZoneDto> {
    return toZoneDto(await this.findOrThrow(id));
  }

  async create(dto: CreateZoneDto, actorId?: string): Promise<ShippingZoneDto> {
    this.assertRates(dto.rates);
    await this.assertCouriers(dto.rates);
    const zone = await this.prisma.shippingZone.create({
      data: {
        name: dto.name,
        countries: dto.countries,
        regions: dto.regions,
        isActive: dto.isActive,
        rates: { create: dto.rates.map(rateData) },
      },
      include: zoneInclude,
    });
    await this.audit.log({
      actorId,
      action: 'shipping.zone.create',
      entityType: 'ShippingZone',
      entityId: zone.id,
      after: toZoneDto(zone),
    });
    return toZoneDto(zone);
  }

  async update(id: string, dto: UpdateZoneDto, actorId?: string): Promise<ShippingZoneDto> {
    const existing = await this.findOrThrow(id);
    if (dto.rates) {
      this.assertRates(dto.rates);
      await this.assertCouriers(dto.rates);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.shippingZone.update({
        where: { id },
        data: {
          name: dto.name,
          countries: dto.countries,
          regions: dto.regions,
          isActive: dto.isActive,
        },
      });
      if (dto.rates) await this.syncRates(tx, existing, dto.rates);
    });
    const updated = await this.findOrThrow(id);
    await this.audit.log({
      actorId,
      action: 'shipping.zone.update',
      entityType: 'ShippingZone',
      entityId: id,
      before: toZoneDto(existing),
      after: toZoneDto(updated),
    });
    return toZoneDto(updated);
  }

  /** Orders keep a snapshot of the chosen method, so zones and rates can be deleted safely. */
  async remove(id: string, actorId?: string): Promise<void> {
    const existing = await this.findOrThrow(id);
    await this.prisma.shippingZone.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'shipping.zone.delete',
      entityType: 'ShippingZone',
      entityId: id,
      before: toZoneDto(existing),
    });
  }

  // ---------------------------------------------------------------- helpers

  private async syncRates(tx: Tx, zone: ZoneRow, rates: ShippingRateInput[]) {
    const known = new Set(zone.rates.map((r) => r.id));
    const keep = rates.filter((r) => r.id && known.has(r.id)).map((r) => r.id as string);
    await tx.shippingRate.deleteMany({ where: { zoneId: zone.id, id: { notIn: keep } } });
    for (const r of rates) {
      if (r.id && known.has(r.id)) {
        await tx.shippingRate.update({ where: { id: r.id }, data: rateData(r) });
      } else {
        await tx.shippingRate.create({ data: { ...rateData(r), zoneId: zone.id } });
      }
    }
  }

  private assertRates(rates: ShippingRateInput[]) {
    for (const r of rates) {
      if (
        r.minWeightGrams != null &&
        r.maxWeightGrams != null &&
        r.minWeightGrams > r.maxWeightGrams
      )
        throw new BadRequestException(`"${r.name}": minimum weight is above the maximum`);
      if (r.minOrderTotal != null && r.maxOrderTotal != null && r.minOrderTotal > r.maxOrderTotal)
        throw new BadRequestException(`"${r.name}": minimum order value is above the maximum`);
    }
  }

  private async assertCouriers(rates: ShippingRateInput[]) {
    const ids = [...new Set(rates.map((r) => r.courierId).filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    const found = await this.prisma.courier.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Unknown courier on a delivery option');
  }

  private async findOrThrow(id: string): Promise<ZoneRow> {
    const zone = await this.prisma.shippingZone.findUnique({ where: { id }, include: zoneInclude });
    if (!zone) throw new NotFoundException('Shipping zone not found');
    return zone;
  }
}
