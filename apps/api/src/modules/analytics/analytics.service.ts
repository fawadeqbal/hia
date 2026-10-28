import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AnalyticsService — Reports, dashboards, exports.
 *
 * Scope responsibilities:
 *  - Admin KPIs: revenue, orders, AOV, conversion, top products/vendors
 *  - Vendor analytics: sales, top products, views
 *  - CSV/Excel exports and scheduled report emails (reports queue)
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  status() {
    return { module: 'analytics', status: 'scaffolded' };
  }
}
