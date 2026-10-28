import type { Prisma } from '@ecommerce/database';

/** The store a user owns, or works for as seller staff (permissions are checked by RolesGuard). */
export const ownedOrStaffed = (userId: string): Prisma.VendorWhereInput => ({
  OR: [{ ownerId: userId }, { staff: { some: { userId } } }],
});
