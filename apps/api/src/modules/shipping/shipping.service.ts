import { Injectable } from '@nestjs/common';
import { toCents, type ShippingDestination, type ShippingOptionDto } from '@ecommerce/types';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { shippingFor } from '../orders/order-rules';
import { toZoneLike, zoneInclude } from './shipping.mapper';
import { matchZone, optionsFor, type Parcel } from './shipping-rules';

export interface ParcelInput extends Parcel {
  vendorId: string;
}

export interface ParcelQuote {
  options: ShippingOptionDto[];
  /** null = nothing delivers this parcel to the destination. */
  selected: ShippingOptionDto | null;
  /** COD fee added by the selected rate. */
  codFeeCents: number;
}

export interface ShippingQuote {
  zoneName: string | null;
  parcels: Map<string, ParcelQuote>;
  /** COD is possible only when every selected option allows it. */
  codAvailable: boolean;
  codFeeCents: number;
  /** Store default (settings) used: no destination yet, or no zone covers it. */
  usedDefault: boolean;
  freeShippingAbove: number;
}

/**
 * Shipping calculator used by checkout. Each seller ships its own parcel:
 * zone (from the destination) → rates that fit the parcel's weight / value → cheapest or the customer's choice.
 * When no zone matches, the store default flat rate applies (settings shipping.flatRatePerVendor / freeShippingAbove).
 */
@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(
    destination: ShippingDestination | null,
    parcels: ParcelInput[],
    chosen: Record<string, string> = {},
  ): Promise<ShippingQuote> {
    const [flatRate, freeAbove, zones] = await Promise.all([
      readSetting(this.prisma, 'shipping.flatRatePerVendor', 5),
      readSetting(this.prisma, 'shipping.freeShippingAbove', 50),
      this.prisma.shippingZone.findMany({ where: { isActive: true }, include: zoneInclude }),
    ]);
    const shapes = zones.map(toZoneLike);
    const zone = matchZone(shapes, destination);
    const codFees = new Map((zone?.rates ?? []).map((r) => [r.id, toCents(r.codFee)] as const));

    const result = new Map<string, ParcelQuote>();
    let codAvailable = true;
    let codFeeCents = 0;
    for (const p of parcels) {
      const options: ShippingOptionDto[] = zone
        ? optionsFor(zone.rates, p)
        : [
            {
              rateId: null,
              name: 'Standard delivery',
              price: shippingFor(p.subtotal, flatRate, freeAbove),
              estimatedDays: null,
              courierName: null,
              codAvailable: true,
            },
          ];
      const selected =
        options.find((o) => o.rateId && o.rateId === chosen[p.vendorId]) ?? options[0] ?? null;
      const fee = selected?.rateId ? (codFees.get(selected.rateId) ?? 0) : 0;
      if (selected && !selected.codAvailable) codAvailable = false;
      codFeeCents += fee;
      result.set(p.vendorId, { options, selected, codFeeCents: fee });
    }
    return {
      zoneName: zone?.name ?? null,
      parcels: result,
      codAvailable,
      codFeeCents,
      usedDefault: zone === null,
      freeShippingAbove: freeAbove,
    };
  }
}
