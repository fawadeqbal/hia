import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Role,
  areaForAdminPath,
  hasAreaAccess,
  levelForMethod,
  vendorAccessForPath,
  type JwtPayload,
} from '@ecommerce/types';
import { AccessService } from '../access/access.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface Req {
  user?: JwtPayload;
  method: string;
  url: string;
  originalUrl?: string;
}

/**
 * 1. SUPER_ADMIN or one of the @Roles → allowed.
 * 2. Admin routes (/admin/<area>/…): roles with the area permission (view for GET, manage otherwise) → allowed.
 *    This is how custom roles from Admin → Settings → Roles work, without per-controller code.
 * 3. Seller routes requiring VENDOR: seller staff with the matching store permission → allowed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Req>();
    const roles = (req.user?.roles ?? []) as string[];
    if (roles.includes(Role.SUPER_ADMIN) || required.some((r) => roles.includes(r))) return true;

    const path = req.originalUrl ?? req.url;
    const area = areaForAdminPath(path);
    if (area && roles.length > 0) {
      const keys = await this.access.permissionsForRoles(roles);
      if (hasAreaAccess(keys, area, levelForMethod(req.method))) return true;
    }

    if (req.user && required.includes(Role.VENDOR) && roles.includes(Role.VENDOR_STAFF)) {
      const need = vendorAccessForPath(path, req.method);
      const staff = await this.access.vendorStaff(req.user.sub);
      if (staff && need && need !== 'owner' && (need === 'any' || staff.permissions.includes(need)))
        return true;
    }

    throw new ForbiddenException('Insufficient role');
  }
}
