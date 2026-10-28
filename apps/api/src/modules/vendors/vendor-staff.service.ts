import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Vendor } from '@ecommerce/database';
import {
  EmailTemplateKey,
  Role,
  VENDOR_STAFF_PERMISSIONS,
  type VendorStaffAccess,
  type VendorStaffDto,
  type VendorStaffPermission,
} from '@ecommerce/types';
import { AccessService } from '../../common/access/access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { InviteVendorStaffDto } from './dto/vendor-staff.dto';

const clean = (p: string[]) => VENDOR_STAFF_PERMISSIONS.filter((k) => p.includes(k));

/** Store owners invite staff with per-area permissions; RolesGuard enforces them on /vendor/* routes. */
@Injectable()
export class VendorStaffService {
  private readonly logger = new Logger(VendorStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async myAccess(userId: string): Promise<VendorStaffAccess> {
    const owned = await this.prisma.vendor.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (owned) return { isOwner: true, permissions: [...VENDOR_STAFF_PERMISSIONS] };
    const staff = await this.access.vendorStaff(userId);
    return { isOwner: false, permissions: clean(staff?.permissions ?? []) };
  }

  async list(ownerId: string): Promise<VendorStaffDto[]> {
    const vendor = await this.ownStore(ownerId);
    const rows = await this.prisma.vendorStaff.findMany({
      where: { vendorId: vendor.id },
      include: { user: { select: { firstName: true, lastName: true, email: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: `${r.user.firstName} ${r.user.lastName}`.trim(),
      email: r.user.email,
      status: r.user.status,
      permissions: clean(r.permissions),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async invite(ownerId: string, dto: InviteVendorStaffDto): Promise<VendorStaffDto> {
    const vendor = await this.ownStore(ownerId);
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        ownedVendors: { select: { id: true } },
        vendorStaff: { select: { vendorId: true } },
      },
    });
    if (user?.deletedAt || user?.status === 'DELETED')
      throw new ConflictException('This email belongs to a deleted account');
    if (user && user.id === ownerId) throw new ConflictException('You already own this store');
    if (user && user.ownedVendors.length > 0)
      throw new ConflictException('This person owns another store');
    if (user && user.vendorStaff.length > 0)
      throw new ConflictException('This person already works for a store');

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          emailPreference: { create: {} },
        },
        include: {
          ownedVendors: { select: { id: true } },
          vendorStaff: { select: { vendorId: true } },
        },
      });
    }
    const userId = user.id;
    await this.prisma.$transaction([
      this.prisma.userRole.createMany({
        data: [
          {
            userId,
            roleId: (
              await this.prisma.role.findUniqueOrThrow({ where: { name: Role.VENDOR_STAFF } })
            ).id,
          },
        ],
        skipDuplicates: true,
      }),
      this.prisma.vendorStaff.create({
        data: { vendorId: vendor.id, userId, permissions: clean(dto.permissions) },
      }),
    ]);
    this.access.invalidate();

    const sellerUrl = this.config
      .get<string>('NEXT_PUBLIC_VENDOR_URL', 'http://localhost:3002')
      .replace(/\/$/, '');
    const setupUrl = user.passwordHash ? null : await this.auth.passwordSetupUrl(userId);
    try {
      await this.notifications.sendEmail({
        template: EmailTemplateKey.STAFF_INVITATION,
        to: user.email,
        userId,
        data: {
          heading: `${vendor.name} invited you to their seller center`,
          body: setupUrl
            ? `Hi ${user.firstName}, choose a password with the button below, then sign in at ${sellerUrl}. The link works for 72 hours.`
            : `Hi ${user.firstName}, sign in at ${sellerUrl} with your existing password.`,
          ctaLabel: setupUrl ? 'Choose a password' : 'Open the seller center',
          ctaUrl: setupUrl ?? sellerUrl,
        },
      });
    } catch (error) {
      this.logger.error(`Could not queue the staff invitation: ${String(error)}`);
    }
    await this.audit.log({
      actorId: ownerId,
      action: 'vendor.staff.invite',
      entityType: 'Vendor',
      entityId: vendor.id,
      after: { email: user.email, permissions: dto.permissions },
    });
    return (await this.list(ownerId)).find((s) => s.userId === userId)!;
  }

  async update(
    ownerId: string,
    id: string,
    permissions: VendorStaffPermission[],
  ): Promise<VendorStaffDto> {
    const vendor = await this.ownStore(ownerId);
    const row = await this.prisma.vendorStaff.findFirst({ where: { id, vendorId: vendor.id } });
    if (!row) throw new NotFoundException('Staff member not found');
    await this.prisma.vendorStaff.update({
      where: { id },
      data: { permissions: clean(permissions) },
    });
    this.access.invalidate();
    await this.audit.log({
      actorId: ownerId,
      action: 'vendor.staff.update',
      entityType: 'Vendor',
      entityId: vendor.id,
      before: { permissions: row.permissions },
      after: { permissions },
    });
    return (await this.list(ownerId)).find((s) => s.id === id)!;
  }

  /** Removes the membership and the seller-staff role, and signs the person out. */
  async remove(ownerId: string, id: string): Promise<void> {
    const vendor = await this.ownStore(ownerId);
    const row = await this.prisma.vendorStaff.findFirst({ where: { id, vendorId: vendor.id } });
    if (!row) throw new NotFoundException('Staff member not found');
    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: Role.VENDOR_STAFF } });
    await this.prisma.$transaction([
      this.prisma.vendorStaff.delete({ where: { id } }),
      this.prisma.userRole.deleteMany({ where: { userId: row.userId, roleId: role.id } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    this.access.invalidate();
    await this.audit.log({
      actorId: ownerId,
      action: 'vendor.staff.remove',
      entityType: 'Vendor',
      entityId: vendor.id,
      before: { userId: row.userId },
    });
  }

  private async ownStore(userId: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor) throw new ForbiddenException('Only the store owner can manage staff');
    return vendor;
  }
}
