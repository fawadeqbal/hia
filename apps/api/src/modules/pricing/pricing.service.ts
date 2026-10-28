import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * PricingService — Price rules, tax calculation, currency conversion.
 *
 * Scope responsibilities:
 *  - Tax calculation by region and tax class (inclusive/exclusive)
 *  - Currency conversion for display using Currency exchange rates
 *  - Single source of truth for line, order and vendor-order totals
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  status() {
    return { module: 'pricing', status: 'scaffolded' };
  }
}
