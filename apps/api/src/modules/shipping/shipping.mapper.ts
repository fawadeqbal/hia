import type { Prisma } from '@ecommerce/database';
import type {
  CourierDto,
  ShippingRateDto,
  ShippingRateType,
  ShippingZoneDto,
} from '@ecommerce/types';
import type { RateLike, ZoneLike } from './shipping-rules';

export const zoneInclude = {
  rates: {
    orderBy: [{ price: 'asc' }, { name: 'asc' }],
    include: { courier: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ShippingZoneInclude;
export type ZoneRow = Prisma.ShippingZoneGetPayload<{ include: typeof zoneInclude }>;
type RateRow = ZoneRow['rates'][number];

export const courierInclude = {
  _count: { select: { shipments: true } },
} satisfies Prisma.CourierInclude;
export type CourierRow = Prisma.CourierGetPayload<{ include: typeof courierInclude }>;

const num = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));

export function toRateDto(r: RateRow): ShippingRateDto {
  return {
    id: r.id,
    name: r.name,
    type: r.type as ShippingRateType,
    courierId: r.courierId,
    courierName: r.courier?.name ?? null,
    price: Number(r.price),
    minWeightGrams: r.minWeightGrams,
    maxWeightGrams: r.maxWeightGrams,
    minOrderTotal: num(r.minOrderTotal),
    maxOrderTotal: num(r.maxOrderTotal),
    freeAbove: num(r.freeAbove),
    codAvailable: r.codAvailable,
    codFee: Number(r.codFee),
    estimatedDays: r.estimatedDays,
    isActive: r.isActive,
  };
}

export function toZoneDto(z: ZoneRow): ShippingZoneDto {
  return {
    id: z.id,
    name: z.name,
    countries: z.countries,
    regions: z.regions,
    isActive: z.isActive,
    rates: z.rates.map(toRateDto),
  };
}

/** Active rates only, in the shape the pure rules use. */
export function toZoneLike(z: ZoneRow): ZoneLike<RateLike & { courierId: string | null }> {
  return {
    ...toZoneDto(z),
    rates: z.rates.filter((r) => r.isActive).map((r) => toRateDto(r)),
  };
}

export function toCourierDto(c: CourierRow): CourierDto {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    trackingUrlTemplate: c.trackingUrlTemplate,
    isActive: c.isActive,
    shipmentCount: c._count.shipments,
  };
}
