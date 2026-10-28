import { ownedOrStaffed } from '../../common/utils/vendor-scope';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { setSellerRate } from './commission-resolver';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { Prisma, Vendor } from '@ecommerce/database';
import {
  EmailTemplateKey,
  Role,
  VENDOR_STATUS_LABELS,
  type EmailJobPayload,
  type Paginated,
  type VendorAdminDto,
  type VendorListItem,
  type VendorPublicDto,
  type VendorSelfDto,
  type VendorStatus,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { uniqueSlug } from '../../common/utils/unique-slug';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  AdminUpdateVendorDto,
  ApplyVendorDto,
  ApproveVendorDto,
  UpdateVendorPayoutDto,
  UpdateVendorProfileDto,
  VendorQueryDto,
} from './dto/vendor.dto';
import {
  toVendorAdminDto,
  toVendorListItem,
  toVendorPublicDto,
  toVendorSelfDto,
  vendorAdminInclude,
  type VendorWithOwner,
} from './vendor.mapper';

/**
 * Vendor lifecycle:  apply → PENDING → (approve) APPROVED ⇄ (suspend/reactivate) SUSPENDED
 *                                    → (reject)  REJECTED → (approve) APPROVED
 * Every decision is audited and emailed to the vendor.
 * TODO: hide a suspended vendor's products (Product step); vendor staff accounts.
 */
@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ================================================================ public

  /** Creates the seller's user account (role VENDOR) and a PENDING store in one transaction. */
  async apply(dto: ApplyVendorDto): Promise<{ vendor: VendorSelfDto; ownerId: string }> {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('An account with this email already exists. Sign in instead.');
    }

    const slug = await this.resolveSlug(dto.storeName);
    const passwordHash = await argon2.hash(dto.password);

    const vendor = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          passwordHash,
          roles: { create: { role: { connect: { name: Role.VENDOR } } } },
          emailPreference: { create: {} },
        },
      });
      return tx.vendor.create({
        data: {
          ownerId: user.id,
          name: dto.storeName,
          slug,
          email,
          phone: dto.phone || null,
          description: dto.description?.trim() || null,
        },
      });
    });

    await this.audit.log({
      actorId: vendor.ownerId,
      action: 'vendor.apply',
      entityType: 'Vendor',
      entityId: vendor.id,
      after: vendor,
    });
    await this.email({
      template: EmailTemplateKey.VENDOR_APPLICATION_RECEIVED,
      to: email,
      userId: vendor.ownerId,
      data: {
        heading: 'We received your application',
        body:
          `Thanks for applying to sell as "${vendor.name}". Our team will review your application and email you the result.\n` +
          'Meanwhile, you can complete your store profile and payout details.',
        ctaLabel: 'Open seller center',
        ctaUrl: this.vendorUrl('/onboarding'),
      },
    });
    await this.emailAdmins(EmailTemplateKey.ADMIN_NEW_VENDOR_APPLICATION, {
      heading: 'New seller application',
      body: `${vendor.name} (${email}) applied to sell on the marketplace.`,
      ctaLabel: 'Review application',
      ctaUrl: this.adminUrl(`/vendors/${vendor.id}`),
    });

    return { vendor: toVendorSelfDto(vendor), ownerId: vendor.ownerId };
  }

  async getPublic(slug: string): Promise<VendorPublicDto> {
    const vendor = await this.prisma.vendor.findUnique({ where: { slug } });
    if (!vendor || vendor.status !== 'APPROVED') throw new NotFoundException('Store not found');
    return toVendorPublicDto(vendor);
  }

  // ================================================================ signed-in vendor

  async getSelf(userId: string): Promise<VendorSelfDto> {
    return toVendorSelfDto(await this.ownVendor(userId));
  }

  async updateProfile(userId: string, dto: UpdateVendorProfileDto): Promise<VendorSelfDto> {
    const vendor = await this.ownVendor(userId);
    const updated = await this.prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        name: dto.name,
        phone: dto.phone,
        description: dto.description,
        logoUrl: dto.logoUrl,
        bannerUrl: dto.bannerUrl,
        policies: dto.policies ? ({ ...dto.policies } as Prisma.InputJsonValue) : undefined,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'vendor.profile.update',
      entityType: 'Vendor',
      entityId: vendor.id,
      before: vendor,
      after: updated,
    });
    return toVendorSelfDto(updated);
  }

  async updatePayout(userId: string, dto: UpdateVendorPayoutDto): Promise<VendorSelfDto> {
    const vendor = await this.ownVendor(userId);
    const updated = await this.prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        bankAccountName: dto.bankAccountName,
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        iban: dto.iban ? dto.iban.replace(/\s+/g, '').toUpperCase() : null,
      },
    });
    // Do not store bank numbers in the audit log.
    await this.audit.log({
      actorId: userId,
      action: 'vendor.payout.update',
      entityType: 'Vendor',
      entityId: vendor.id,
    });
    return toVendorSelfDto(updated);
  }

  // ================================================================ admin

  async adminList(query: VendorQueryDto): Promise<Paginated<VendorListItem>> {
    const where: Prisma.VendorWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        include: vendorAdminInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return paginate(rows.map(toVendorListItem), total, query.page, query.limit);
  }

  async adminGet(id: string): Promise<VendorAdminDto> {
    return toVendorAdminDto(await this.findWithOwner(id));
  }

  async adminUpdate(
    id: string,
    dto: AdminUpdateVendorDto,
    actorId?: string,
  ): Promise<VendorAdminDto> {
    const before = toVendorAdminDto(await this.findWithOwner(id));
    if (dto.commissionRate !== undefined) {
      // The seller's rate is their own commission rule (see Commissions page).
      await setSellerRate(this.prisma, id, dto.commissionRate);
      await this.audit.log({
        actorId,
        action: 'vendor.commission',
        entityType: 'Vendor',
        entityId: id,
        before: { commissionRate: before.commissionRate },
        after: { commissionRate: dto.commissionRate },
      });
    }
    return toVendorAdminDto(await this.findWithOwner(id));
  }

  async approve(id: string, dto: ApproveVendorDto, actorId?: string): Promise<VendorAdminDto> {
    const vendor = await this.transition(id, ['PENDING', 'REJECTED'], 'APPROVED', {
      actorId,
      action: 'vendor.approve',
      data: {},
    });
    if (dto.commissionRate !== undefined) await setSellerRate(this.prisma, id, dto.commissionRate);
    await this.email({
      template: EmailTemplateKey.VENDOR_APPROVED,
      to: vendor.email,
      userId: vendor.ownerId,
      data: {
        heading: 'Your store is approved 🎉',
        body: `Good news, "${vendor.name}" is approved. You can now add products and start selling.`,
        ctaLabel: 'Go to seller center',
        ctaUrl: this.vendorUrl('/'),
      },
    });
    return dto.commissionRate !== undefined
      ? toVendorAdminDto(await this.findWithOwner(id))
      : toVendorAdminDto(vendor);
  }

  async reject(id: string, reason: string, actorId?: string): Promise<VendorAdminDto> {
    const vendor = await this.transition(id, ['PENDING'], 'REJECTED', {
      actorId,
      action: 'vendor.reject',
      reason,
    });
    await this.email({
      template: EmailTemplateKey.VENDOR_REJECTED,
      to: vendor.email,
      userId: vendor.ownerId,
      data: {
        heading: 'Update on your seller application',
        body: `We could not approve "${vendor.name}" at this time.\nReason: ${reason}`,
        ctaLabel: 'View details',
        ctaUrl: this.vendorUrl('/onboarding'),
      },
    });
    return toVendorAdminDto(vendor);
  }

  async suspend(id: string, reason: string, actorId?: string): Promise<VendorAdminDto> {
    const vendor = await this.transition(id, ['APPROVED'], 'SUSPENDED', {
      actorId,
      action: 'vendor.suspend',
      reason,
    });
    await this.email({
      template: EmailTemplateKey.VENDOR_SUSPENDED,
      to: vendor.email,
      userId: vendor.ownerId,
      data: {
        heading: 'Your seller account has been suspended',
        body: `"${vendor.name}" has been suspended and its products are hidden.\nReason: ${reason}`,
        ctaLabel: 'View details',
        ctaUrl: this.vendorUrl('/onboarding'),
      },
    });
    return toVendorAdminDto(vendor);
  }

  async reactivate(id: string, actorId?: string): Promise<VendorAdminDto> {
    const vendor = await this.transition(id, ['SUSPENDED'], 'APPROVED', {
      actorId,
      action: 'vendor.reactivate',
    });
    await this.email({
      template: EmailTemplateKey.VENDOR_APPROVED,
      to: vendor.email,
      userId: vendor.ownerId,
      data: {
        heading: 'Your store is active again',
        body: `"${vendor.name}" has been reactivated. Your products are visible to customers again.`,
        ctaLabel: 'Go to seller center',
        ctaUrl: this.vendorUrl('/'),
      },
    });
    return toVendorAdminDto(vendor);
  }

  // ================================================================ helpers

  private async transition(
    id: string,
    from: VendorStatus[],
    to: VendorStatus,
    opts: { actorId?: string; action: string; reason?: string; data?: Prisma.VendorUpdateInput },
  ): Promise<VendorWithOwner> {
    const vendor = await this.findWithOwner(id);
    if (!from.includes(vendor.status as VendorStatus)) {
      throw new BadRequestException(
        `Cannot change a vendor from "${VENDOR_STATUS_LABELS[vendor.status as VendorStatus]}" to "${VENDOR_STATUS_LABELS[to]}"`,
      );
    }
    const updated = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...opts.data,
        status: to,
        statusReason: opts.reason ?? null,
        ...(to === 'APPROVED' && !vendor.approvedAt ? { approvedAt: new Date() } : {}),
      },
      include: vendorAdminInclude,
    });
    await this.audit.log({
      actorId: opts.actorId,
      action: opts.action,
      entityType: 'Vendor',
      entityId: id,
      before: { status: vendor.status, statusReason: vendor.statusReason },
      after: { status: updated.status, statusReason: updated.statusReason },
    });
    return updated;
  }

  private async findWithOwner(id: string): Promise<VendorWithOwner> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: vendorAdminInclude,
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  private async ownVendor(userId: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findFirst({
      where: ownedOrStaffed(userId),
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor) throw new NotFoundException('No store is linked to this account');
    return vendor;
  }

  private resolveSlug(storeName: string): Promise<string> {
    return uniqueSlug({
      source: storeName,
      entity: 'store',
      isTaken: async (slug) =>
        Boolean(await this.prisma.vendor.findUnique({ where: { slug }, select: { id: true } })),
    });
  }

  /** Email failures (e.g. Redis down) must never undo a committed business action. */
  private async email(payload: EmailJobPayload): Promise<void> {
    try {
      await this.notifications.sendEmail(payload);
    } catch (error) {
      this.logger.error(`Could not queue ${payload.template} to ${payload.to}: ${String(error)}`);
    }
  }

  private async emailAdmins(template: EmailJobPayload['template'], data: Record<string, unknown>) {
    const admins = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: { name: { in: [Role.ADMIN, Role.SUPER_ADMIN] } } } },
        status: { not: 'DELETED' },
      },
      select: { id: true, email: true },
    });
    for (const admin of admins)
      await this.email({ template, to: admin.email, userId: admin.id, data });
  }

  private vendorUrl(path: string) {
    return `${this.config.get<string>('NEXT_PUBLIC_VENDOR_URL', 'http://localhost:3002')}${path}`;
  }

  private adminUrl(path: string) {
    return `${this.config.get<string>('NEXT_PUBLIC_ADMIN_URL', 'http://localhost:3001')}${path}`;
  }
}
