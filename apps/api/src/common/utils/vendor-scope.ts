import type { Prisma } from '@ecommerce/database';

/** The store a user owns (single shop: the super admin owns the one store). */
export const ownedOrStaffed = (userId: string): Prisma.VendorWhereInput => ({ ownerId: userId });
