import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string;
  /** e.g. "catalog.category.update" */
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/**
 * AuditService — records admin and vendor actions in AuditLog.
 * TODO: admin audit log viewer with filters (GET /admin/audit-logs).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: a failed audit write must not break the business action. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: toJson(entry.before),
          after: toJson(entry.after),
          ip: entry.ip,
        },
      });
    } catch (error) {
      this.logger.error(`Audit write failed for ${entry.action}: ${String(error)}`);
    }
  }

  status() {
    return { module: 'audit', status: 'partial' };
  }
}

/** Serialises Dates/Decimals so any Prisma record can be stored as JSON. */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
