import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Banner } from '@ecommerce/database';
import type { BannerDto } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toBannerDto } from './cms.mapper';
import type { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

const toDate = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : new Date(v);

/** Promotional images per placement, optionally scheduled (startsAt / endsAt). */
@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<BannerDto[]> {
    const banners = await this.prisma.banner.findMany({
      orderBy: [{ placement: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
    });
    const now = new Date();
    return banners.map((b) => toBannerDto(b, now));
  }

  async get(id: string): Promise<BannerDto> {
    return toBannerDto(await this.findOrThrow(id));
  }

  async create(dto: CreateBannerDto, actorId?: string): Promise<BannerDto> {
    const startsAt = toDate(dto.startsAt) ?? null;
    const endsAt = toDate(dto.endsAt) ?? null;
    this.checkSchedule(startsAt, endsAt);
    const created = await this.prisma.banner.create({
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        mobileImageUrl: dto.mobileImageUrl ?? null,
        linkUrl: dto.linkUrl ?? null,
        placement: dto.placement,
        position: dto.position ?? 0,
        startsAt,
        endsAt,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      actorId,
      action: 'cms.banner.create',
      entityType: 'Banner',
      entityId: created.id,
      after: created,
    });
    return toBannerDto(created);
  }

  async update(id: string, dto: UpdateBannerDto, actorId?: string): Promise<BannerDto> {
    const existing = await this.findOrThrow(id);
    const startsAt = toDate(dto.startsAt);
    const endsAt = toDate(dto.endsAt);
    this.checkSchedule(
      startsAt === undefined ? existing.startsAt : startsAt,
      endsAt === undefined ? existing.endsAt : endsAt,
    );
    const updated = await this.prisma.banner.update({
      where: { id },
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        mobileImageUrl: dto.mobileImageUrl,
        linkUrl: dto.linkUrl,
        placement: dto.placement,
        position: dto.position,
        startsAt,
        endsAt,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId,
      action: 'cms.banner.update',
      entityType: 'Banner',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toBannerDto(updated);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const existing = await this.findOrThrow(id);
    await this.prisma.banner.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'cms.banner.delete',
      entityType: 'Banner',
      entityId: id,
      before: existing,
    });
  }

  private checkSchedule(startsAt: Date | null, endsAt: Date | null) {
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('The banner must end after it starts');
    }
  }

  private async findOrThrow(id: string): Promise<Banner> {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }
}
