import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, type JwtPayload } from '@ecommerce/types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Single-shop build: SUPER_ADMIN (the shop owner) passes every check; otherwise the user needs one of the
 * @Roles. The shop's "store" routes (/vendor/…) are therefore available to the super admin.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const roles = (context.switchToHttp().getRequest<{ user?: JwtPayload }>().user?.roles ??
      []) as string[];
    if (roles.includes(Role.SUPER_ADMIN) || required.some((r) => roles.includes(r))) return true;
    throw new ForbiddenException('Insufficient role');
  }
}
