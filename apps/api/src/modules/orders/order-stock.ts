import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import { allocate } from './order-rules';

type Tx = Prisma.TransactionClient;

export interface LineToReserve {
  variantId: string;
  quantity: number;
  label: string;
}

/** COD / paid orders hold stock until shipped. */
export const HOLD_DAYS = 30;

/**
 * Reserves stock for every line inside the checkout transaction.
 * The reserved counter is incremented atomically and re-checked, so two checkouts can never oversell.
 */
export async function reserveStock(
  tx: Tx,
  orderId: string,
  lines: LineToReserve[],
  /** Unpaid online orders: minutes until the payment deadline. */
  holdMinutes?: number,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + (holdMinutes ? holdMinutes * 60 * 1000 : HOLD_DAYS * 24 * 60 * 60 * 1000),
  );
  for (const line of lines) {
    const levels = await tx.stockLevel.findMany({
      where: { variantId: line.variantId, warehouse: { isActive: true } },
    });
    const plan = allocate(
      levels.map((l) => ({
        stockLevelId: l.id,
        warehouseId: l.warehouseId,
        available: l.quantity - l.reserved,
      })),
      line.quantity,
    );
    if (!plan)
      throw new BadRequestException(
        `"${line.label}" no longer has enough stock. Please update your cart.`,
      );

    for (const part of plan) {
      const updated = await tx.stockLevel.update({
        where: { id: part.stockLevelId },
        data: { reserved: { increment: part.quantity } },
      });
      if (updated.reserved > updated.quantity) {
        throw new BadRequestException(`"${line.label}" just sold out. Please update your cart.`);
      }
      await tx.stockReservation.create({
        data: {
          orderId,
          variantId: line.variantId,
          warehouseId: part.warehouseId,
          quantity: part.quantity,
          expiresAt,
        },
      });
    }
  }
}

/** Gives reserved stock back (cancellation). */
export async function releaseStock(tx: Tx, orderId: string, variantIds: string[]): Promise<void> {
  const reservations = await tx.stockReservation.findMany({
    where: { orderId, variantId: { in: variantIds }, releasedAt: null },
  });
  for (const r of reservations) {
    if (r.warehouseId) {
      await tx.stockLevel.update({
        where: { variantId_warehouseId: { variantId: r.variantId, warehouseId: r.warehouseId } },
        data: { reserved: { decrement: r.quantity } },
      });
    }
    await tx.stockReservation.update({ where: { id: r.id }, data: { releasedAt: new Date() } });
  }
}

/** Turns reservations into sales when the parcel ships: on hand and reserved both go down, SALE movement logged. */
export async function commitStock(
  tx: Tx,
  orderId: string,
  orderNumber: string,
  variantIds: string[],
  actorId?: string,
): Promise<void> {
  const reservations = await tx.stockReservation.findMany({
    where: { orderId, variantId: { in: variantIds }, releasedAt: null },
  });
  for (const r of reservations) {
    if (r.warehouseId) {
      await tx.stockLevel.update({
        where: { variantId_warehouseId: { variantId: r.variantId, warehouseId: r.warehouseId } },
        data: { quantity: { decrement: r.quantity }, reserved: { decrement: r.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          variantId: r.variantId,
          warehouseId: r.warehouseId,
          type: 'SALE',
          quantity: -r.quantity,
          reference: orderNumber,
          note: 'Shipped',
          createdById: actorId,
        },
      });
    }
    await tx.stockReservation.update({ where: { id: r.id }, data: { releasedAt: new Date() } });
  }
}
