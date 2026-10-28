import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@ecommerce/types';

/** Injects the authenticated user's JWT payload. */
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    return field ? request.user?.[field] : request.user;
  },
);
