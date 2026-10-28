import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CourierDto } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateCourierDto, UpdateCourierDto } from './dto/shipping.dto';
import { courierInclude, toCourierDto } from './shipping.mapper';

/** Couriers: name, code and the tracking link template ({tracking} is replaced by the number). */
@Injectable()
export class CouriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(activeOnly = false): Promise<CourierDto[]> {
    const rows = await this.prisma.courier.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: courierInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(toCourierDto);
  }

  async create(dto: CreateCourierDto, actorId?: string): Promise<CourierDto> {
    await this.assertCodeFree(dto.code);
    const courier = await this.prisma.courier.create({
      data: {
        name: dto.name,
        code: dto.code,
        trackingUrlTemplate: dto.trackingUrlTemplate || null,
        isActive: dto.isActive,
      },
      include: courierInclude,
    });
    await this.audit.log({
      actorId,
      action: 'shipping.courier.create',
      entityType: 'Courier',
      entityId: courier.id,
      after: dto,
    });
    return toCourierDto(courier);
  }

  async update(id: string, dto: UpdateCourierDto, actorId?: string): Promise<CourierDto> {
    const existing = await this.findOrThrow(id);
    if (dto.code && dto.code !== existing.code) await this.assertCodeFree(dto.code);
    const courier = await this.prisma.courier.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        trackingUrlTemplate:
          dto.trackingUrlTemplate === undefined ? undefined : dto.trackingUrlTemplate || null,
        isActive: dto.isActive,
      },
      include: courierInclude,
    });
    await this.audit.log({
      actorId,
      action: 'shipping.courier.update',
      entityType: 'Courier',
      entityId: id,
      before: existing,
      after: dto,
    });
    return toCourierDto(courier);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const existing = await this.findOrThrow(id);
    const shipments = await this.prisma.shipment.count({ where: { courierId: id } });
    if (shipments > 0)
      throw new ConflictException(
        `${existing.name} carried ${shipments} shipment(s) — deactivate it instead`,
      );
    await this.prisma.$transaction([
      this.prisma.shippingRate.updateMany({ where: { courierId: id }, data: { courierId: null } }),
      this.prisma.courier.delete({ where: { id } }),
    ]);
    await this.audit.log({
      actorId,
      action: 'shipping.courier.delete',
      entityType: 'Courier',
      entityId: id,
      before: existing,
    });
  }

  private async assertCodeFree(code: string) {
    if (await this.prisma.courier.findUnique({ where: { code } }))
      throw new ConflictException(`A courier with code "${code}" already exists`);
  }

  private async findOrThrow(id: string) {
    const courier = await this.prisma.courier.findUnique({ where: { id } });
    if (!courier) throw new NotFoundException('Courier not found');
    return courier;
  }
}
