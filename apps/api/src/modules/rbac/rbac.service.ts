import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  ALL_PERMISSION_KEYS,
  EmailTemplateKey,
  NON_STAFF_ROLES,
  Role,
  type AccessDto,
  type AuditLogItem,
  type Paginated,
  type RoleDto,
  type StaffUserDto,
} from '@ecommerce/types';
import { AccessService } from '../../common/access/access.service';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  AuditLogQueryDto,
  CreateRoleDto,
  InviteStaffDto,
  UpdateRoleDto,
} from './dto/rbac.dto';

const staffUserInclude = {
  roles: { include: { role: { select: { id: true, name: true } } } },
} satisfies Prisma.UserInclude;
type StaffRow = Prisma.UserGetPayload<{ include: typeof staffUserInclude }>;

const isStaffRole = (name: string) => !NON_STAFF_ROLES.includes(name);

/** Roles & permissions, admin staff accounts and the audit log viewer. */
@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ================================================================ my access (admin app menu)

  async myAccess(userId: string): Promise<AccessDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: staffUserInclude,
    });
    const roles = user.roles.map((r) => r.role.name);
    const permissions = await this.access.permissionsForRoles(roles);
    return {
      userId,
      roles,
      isSuperAdmin: roles.includes(Role.SUPER_ADMIN),
      permissions: [...permissions],
    };
  }

  // ================================================================ roles

  async roles(): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      where: { name: { notIn: NON_STAFF_ROLES } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions:
        r.name === Role.SUPER_ADMIN
          ? ALL_PERMISSION_KEYS
          : r.permissions
              .map((p) => p.permission.key)
              .filter((k) => ALL_PERMISSION_KEYS.includes(k)),
      userCount: r._count.users,
    }));
  }

  async createRole(dto: CreateRoleDto, actorId: string): Promise<RoleDto> {
    if (await this.prisma.role.findUnique({ where: { name: dto.name } })) {
      throw new ConflictException(`A role called ${dto.name} already exists`);
    }
    const role = await this.prisma.role.create({
      data: { name: dto.name, description: dto.description ?? null, isSystem: false },
    });
    await this.setPermissions(role.id, dto.permissions);
    await this.audit.log({
      actorId,
      action: 'rbac.role.create',
      entityType: 'Role',
      entityId: role.id,
      after: { ...dto },
    });
    return this.roleDto(role.id);
  }

  async updateRole(id: string, dto: UpdateRoleDto, actorId: string): Promise<RoleDto> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem)
      throw new BadRequestException(
        "Built-in roles can't be changed — create a custom role instead",
      );
    const before = await this.roleDto(id);
    if (dto.description !== undefined)
      await this.prisma.role.update({ where: { id }, data: { description: dto.description } });
    if (dto.permissions) await this.setPermissions(id, dto.permissions);
    const after = await this.roleDto(id);
    await this.audit.log({
      actorId,
      action: 'rbac.role.update',
      entityType: 'Role',
      entityId: id,
      before,
      after,
    });
    return after;
  }

  async removeRole(id: string, actorId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException("Built-in roles can't be deleted");
    if (role._count.users > 0)
      throw new ConflictException(`${role._count.users} staff member(s) still have this role`);
    await this.prisma.role.delete({ where: { id } });
    this.access.invalidate();
    await this.audit.log({
      actorId,
      action: 'rbac.role.delete',
      entityType: 'Role',
      entityId: id,
      before: { name: role.name },
    });
  }

  // ================================================================ staff

  async staff(): Promise<StaffUserDto[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { name: { notIn: NON_STAFF_ROLES } } } } },
      include: staffUserInclude,
      orderBy: { createdAt: 'asc' },
    });
    return users.map(toStaffDto);
  }

  /** Adds staff roles to an existing account, or creates the account and emails a set-password link. */
  async inviteStaff(
    dto: InviteStaffDto,
    actor: { sub: string; roles: string[] },
  ): Promise<StaffUserDto> {
    const roleIds = await this.checkGrantable(dto.roleIds, actor);
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user && (user.status === 'DELETED' || user.deletedAt))
      throw new ConflictException('This email belongs to a deleted account');
    const isNew = !user;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          emailPreference: { create: {} },
        },
      });
    }
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId: user!.id, roleId })),
      skipDuplicates: true,
    });
    this.access.invalidate();

    const adminUrl = this.config
      .get<string>('NEXT_PUBLIC_ADMIN_URL', 'http://localhost:3001')
      .replace(/\/$/, '');
    const setupUrl = user.passwordHash ? null : await this.auth.passwordSetupUrl(user.id);
    await this.email(user.email, user.id, {
      heading: 'You have been invited to the admin panel',
      body: setupUrl
        ? `Hi ${user.firstName}, you now have staff access. Choose a password with the button below, then sign in at ${adminUrl}. The link works for 72 hours.`
        : `Hi ${user.firstName}, you now have staff access. Sign in at ${adminUrl} with your existing password.`,
      ctaLabel: setupUrl ? 'Choose a password' : 'Open the admin panel',
      ctaUrl: setupUrl ?? adminUrl,
    });
    await this.audit.log({
      actorId: actor.sub,
      action: 'rbac.staff.invite',
      entityType: 'User',
      entityId: user.id,
      after: { email: user.email, roleIds, newAccount: isNew },
    });
    return this.staffDto(user.id);
  }

  async updateStaffRoles(
    id: string,
    roleIdsInput: string[],
    actor: { sub: string; roles: string[] },
  ): Promise<StaffUserDto> {
    if (id === actor.sub) throw new BadRequestException("You can't change your own roles");
    const user = await this.findStaff(id);
    const roleIds = await this.checkGrantable(roleIdsInput, actor);
    if (roleIds.length === 0)
      throw new BadRequestException('Give at least one role, or deactivate the account instead');

    const current = user.roles.filter((r) => isStaffRole(r.role.name));
    const losingSuper =
      current.some((r) => r.role.name === Role.SUPER_ADMIN) &&
      !(await this.roleNames(roleIds)).includes(Role.SUPER_ADMIN);
    if (losingSuper) await this.assertAnotherSuperAdmin(id);

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({
        where: { userId: id, roleId: { in: current.map((r) => r.role.id) } },
      }),
      this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
        skipDuplicates: true,
      }),
    ]);
    this.access.invalidate();
    await this.audit.log({
      actorId: actor.sub,
      action: 'rbac.staff.roles',
      entityType: 'User',
      entityId: id,
      before: { roles: current.map((r) => r.role.name) },
      after: { roles: await this.roleNames(roleIds) },
    });
    return this.staffDto(id);
  }

  async setStaffActive(id: string, active: boolean, actorId: string): Promise<StaffUserDto> {
    if (id === actorId) throw new BadRequestException("You can't deactivate your own account");
    const user = await this.findStaff(id);
    if (!active && user.roles.some((r) => r.role.name === Role.SUPER_ADMIN))
      await this.assertAnotherSuperAdmin(id);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          status: active
            ? user.emailVerifiedAt || user.passwordHash
              ? 'ACTIVE'
              : 'PENDING_VERIFICATION'
            : 'BLOCKED',
        },
      }),
      ...(active
        ? []
        : [
            this.prisma.refreshToken.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]),
    ]);
    await this.audit.log({
      actorId,
      action: active ? 'rbac.staff.activate' : 'rbac.staff.deactivate',
      entityType: 'User',
      entityId: id,
    });
    return this.staffDto(id);
  }

  // ================================================================ audit log

  async auditLogs(
    q: Pick<AuditLogQueryDto, 'page' | 'limit' | 'action' | 'entityType' | 'actor' | 'from' | 'to'>,
  ): Promise<Paginated<AuditLogItem>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.action ? { action: { contains: q.action, mode: 'insensitive' as const } } : {}),
      ...(q.entityType
        ? { entityType: { equals: q.entityType, mode: 'insensitive' as const } }
        : {}),
      ...(q.actor ? { actor: { email: { contains: q.actor, mode: 'insensitive' as const } } } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(`${q.from.slice(0, 10)}T00:00:00.000Z`) } : {}),
              ...(q.to ? { lte: new Date(`${q.to.slice(0, 10)}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actor: r.actor
          ? {
              id: r.actor.id,
              name: `${r.actor.firstName} ${r.actor.lastName}`.trim(),
              email: r.actor.email,
            }
          : null,
        before: r.before,
        after: r.after,
        ip: r.ip,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      q.page,
      q.limit,
    );
  }

  // ================================================================ helpers

  private async setPermissions(roleId: string, keysInput: string[]) {
    const keys = [...new Set(keysInput)].filter((k) => ALL_PERMISSION_KEYS.includes(k));
    for (const key of keys)
      await this.prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
    const perms = await this.prisma.permission.findMany({ where: { key: { in: keys } } });
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
      }),
    ]);
    this.access.invalidate();
  }

  /** Only staff roles can be granted here, and only a super admin can grant SUPER_ADMIN. */
  private async checkGrantable(roleIds: string[], actor: { roles: string[] }): Promise<string[]> {
    const unique = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({ where: { id: { in: unique } } });
    if (roles.length !== unique.length) throw new BadRequestException('Unknown role');
    if (roles.some((r) => !isStaffRole(r.name)))
      throw new BadRequestException('Customer and seller roles are not staff roles');
    if (roles.some((r) => r.name === Role.SUPER_ADMIN) && !actor.roles.includes(Role.SUPER_ADMIN)) {
      throw new ForbiddenException('Only a super admin can grant super admin');
    }
    return unique;
  }

  private async assertAnotherSuperAdmin(exceptUserId: string) {
    const others = await this.prisma.user.count({
      where: {
        id: { not: exceptUserId },
        status: { not: 'BLOCKED' },
        deletedAt: null,
        roles: { some: { role: { name: Role.SUPER_ADMIN } } },
      },
    });
    if (others === 0)
      throw new BadRequestException('There must always be at least one active super admin');
  }

  private async roleNames(ids: string[]): Promise<string[]> {
    return (
      await this.prisma.role.findMany({ where: { id: { in: ids } }, select: { name: true } })
    ).map((r) => r.name);
  }

  private async findStaff(id: string): Promise<StaffRow> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: staffUserInclude,
    });
    if (!user || !user.roles.some((r) => isStaffRole(r.role.name)))
      throw new NotFoundException('Staff member not found');
    return user;
  }

  private async staffDto(id: string): Promise<StaffUserDto> {
    return toStaffDto(
      await this.prisma.user.findUniqueOrThrow({ where: { id }, include: staffUserInclude }),
    );
  }

  private async roleDto(id: string): Promise<RoleDto> {
    const dto = (await this.roles()).find((r) => r.id === id);
    if (!dto) throw new NotFoundException('Role not found');
    return dto;
  }

  private async email(to: string, userId: string, data: Record<string, unknown>) {
    try {
      await this.notifications.sendEmail({
        template: EmailTemplateKey.STAFF_INVITATION,
        to,
        userId,
        data,
      });
    } catch (error) {
      this.logger.error(`Could not queue the invitation for ${to}: ${String(error)}`);
    }
  }
}

function toStaffDto(u: StaffRow): StaffUserDto {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    status: u.status,
    roles: u.roles
      .filter((r) => isStaffRole(r.role.name))
      .map((r) => ({ id: r.role.id, name: r.role.name })),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}
