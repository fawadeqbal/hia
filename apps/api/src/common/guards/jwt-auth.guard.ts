import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// ---- device-session revocation (instant sign-out) ----
const CHECK_TTL_MS = 30_000;
const KEEP_REVOKED_MS = 20 * 60_000; // longer than any access token lives
const sessionState = new Map<string, { revoked: boolean; at: number }>();

/** Called when sessions end, so their access tokens stop working immediately. */
export function markSessionsRevoked(ids: string[]): void {
  const at = Date.now();
  for (const id of ids) sessionState.set(id, { revoked: true, at });
}

/**
 * Protected routes require a valid JWT.
 * @Public() routes never fail, but still attach the user when a valid token is present
 * (e.g. the cart works for guests and signed-in users).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const token = this.extractToken(request);

    if (isPublic) {
      if (token) request.user = await this.verify(token).catch(() => undefined);
      return true;
    }

    if (!token) throw new UnauthorizedException('Missing access token');
    try {
      request.user = await this.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return true;
  }

  private async verify(token: string): Promise<JwtPayload> {
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
    if (payload.sid && (await this.isRevoked(payload.sid))) throw new Error('Session ended');
    return payload;
  }

  private async isRevoked(sid: string): Promise<boolean> {
    const now = Date.now();
    const known = sessionState.get(sid);
    if (known && (known.revoked ? now - known.at < KEEP_REVOKED_MS : now - known.at < CHECK_TTL_MS)) {
      return known.revoked;
    }
    if (!this.prisma) return false;
    const row = await this.prisma.session.findUnique({
      where: { id: sid },
      select: { revokedAt: true },
    });
    const revoked = !row || row.revokedAt !== null;
    sessionState.set(sid, { revoked, at: now });
    if (sessionState.size > 50_000) sessionState.clear();
    return revoked;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) return token;
    return (request.cookies as Record<string, string> | undefined)?.access_token;
  }
}
