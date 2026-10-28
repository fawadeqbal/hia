import { Prisma } from '@ecommerce/database';
import type { PrismaService } from '../../prisma/prisma.service';
import { ShippingService } from './shipping.service';

const rate = (id: string, name: string, type: string, price: number) => ({
  id,
  zoneId: 'z1',
  name,
  type,
  courierId: null,
  courier: null,
  price: new Prisma.Decimal(price),
  minWeightGrams: null,
  maxWeightGrams: null,
  minOrderTotal: null,
  maxOrderTotal: null,
  freeAbove: null,
  codAvailable: true,
  codFee: new Prisma.Decimal(0),
  estimatedDays: null,
  isActive: true,
});

function service() {
  const prisma = {
    setting: { findUnique: jest.fn().mockResolvedValue(null) },
    shippingZone: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'z1',
          name: 'Pakistan',
          countries: ['PK'],
          regions: [],
          isActive: true,
          rates: [
            rate('pick', 'Pick up from shop', 'PICKUP', 0),
            rate('std', 'Standard delivery', 'FLAT', 500),
          ],
        },
      ]),
    },
  };
  return new ShippingService(prisma as unknown as PrismaService);
}

const dest = { countryCode: 'PK', state: null, city: 'Islamabad' };
const parcel = { vendorId: 'v1', subtotal: 1800, weightGrams: 0 };

describe('ShippingService.quote — default option', () => {
  it('pre-selects delivery even when shop pickup is cheaper', async () => {
    const q = await service().quote(dest, [parcel]);
    const p = q.parcels.get('v1')!;
    expect(p.options.map((o) => o.name)).toEqual(['Pick up from shop', 'Standard delivery']);
    expect(p.selected?.rateId).toBe('std');
  });

  it('keeps pickup when the customer chose it', async () => {
    const q = await service().quote(dest, [parcel], { v1: 'pick' });
    expect(q.parcels.get('v1')!.selected?.rateId).toBe('pick');
  });
});
