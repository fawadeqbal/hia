import { Injectable } from '@nestjs/common';
import { ALL_PERMISSION_KEYS, Role } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';

const TTL_MS = 60_000;

interface Cached<T> {
  at: number;
  value: T;
}

/** Resolves role permissions and seller-staff memberships for the guard, cached for a minute. */
@Injectable()
export class AccessService {
  private readonly roleCache = new Map<string, Cached<Set<string>>>();
  private readonly staffCache = new Map<
    string,
    Cached<{ vendorId: string; permissions: string[] } | null>
  >();

  constructor(private readonly prisma: PrismaService) {}

  async permissionsForRoles(roles: string[]): Promise<Set<string>> {
    if (roles.includes(Role.SUPER_ADMIN)) return new Set(ALL_PERMISSION_KEYS);
    const key = [...roles].sort().join('|');
    const hit = this.roleCache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { name: { in: roles } } },
      select: { permission: { select: { key: true } } },
    });
    const value = new Set(rows.map((r) => r.permission.key));
    this.roleCache.set(key, { at: Date.now(), value });
    return value;
  }

  /** The store a seller-staff user works for (approved or suspended stores only). */
  async vendorStaff(userId: string): Promise<{ vendorId: string; permissions: string[] } | null> {
    const hit = this.staffCache.get(userId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const row = await this.prisma.vendorStaff.findFirst({
      where: { userId, vendor: { status: { in: ['APPROVED', 'SUSPENDED'] } } },
      orderBy: { createdAt: 'asc' },
    });
    const value = row ? { vendorId: row.vendorId, permissions: row.permissions } : null;
    this.staffCache.set(userId, { at: Date.now(), value });
    return value;
  }

  /** Call after changing roles, permissions or staff memberships. */
  invalidate(): void {
    this.roleCache.clear();
    this.staffCache.clear();
  }
}
