import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrderNote } from '@ecommerce/database';
import type { CustomerOrderNoteDto, OrderNoteDto, OrderNoteInput } from '@ecommerce/types';
import { ownedOrStaffed } from '../../../common/utils/vendor-scope';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

/**
 * Order notes. Staff: on the whole order or one sub-order, any note can be removed.
 * Sellers: only on their sub-order, see notes on it, remove their own. Customers: only notes marked visible.
 */
@Injectable()
export class OrderNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async adminList(orderId: string, actorId: string): Promise<OrderNoteDto[]> {
    await this.orderOrThrow(orderId);
    const notes = await this.prisma.orderNote.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return this.toDtos(notes, () => true, actorId);
  }

  async adminAdd(orderId: string, input: OrderNoteInput, actorId: string): Promise<OrderNoteDto> {
    await this.orderOrThrow(orderId);
    if (input.vendorOrderId) {
      const vo = await this.prisma.vendorOrder.findFirst({
        where: { id: input.vendorOrderId, orderId },
      });
      if (!vo) throw new BadRequestException('That seller order is not part of this order');
    }
    const note = await this.create(orderId, input.vendorOrderId ?? null, input, actorId);
    return (await this.toDtos([note], () => true, actorId))[0]!;
  }

  async adminRemove(orderId: string, noteId: string, actorId: string): Promise<void> {
    const note = await this.prisma.orderNote.findFirst({ where: { id: noteId, orderId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.remove(note, actorId);
  }

  async vendorList(userId: string, vendorOrderId: string): Promise<OrderNoteDto[]> {
    await this.vendorOrderOf(userId, vendorOrderId);
    const notes = await this.prisma.orderNote.findMany({
      where: { vendorOrderId },
      orderBy: { createdAt: 'asc' },
    });
    return this.toDtos(notes, (n) => n.authorId === userId, userId);
  }

  async vendorAdd(
    userId: string,
    vendorOrderId: string,
    input: OrderNoteInput,
  ): Promise<OrderNoteDto> {
    const vo = await this.vendorOrderOf(userId, vendorOrderId);
    const note = await this.create(vo.orderId, vo.id, input, userId);
    return (await this.toDtos([note], () => true, userId))[0]!;
  }

  async vendorRemove(userId: string, vendorOrderId: string, noteId: string): Promise<void> {
    await this.vendorOrderOf(userId, vendorOrderId);
    const note = await this.prisma.orderNote.findFirst({ where: { id: noteId, vendorOrderId } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.authorId !== userId)
      throw new ForbiddenException('You can only delete your own notes');
    await this.remove(note, userId);
  }

  async customerList(userId: string, orderNumber: string): Promise<CustomerOrderNoteDto[]> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const notes = await this.prisma.orderNote.findMany({
      where: { orderId: order.id, isCustomerVisible: true },
      orderBy: { createdAt: 'asc' },
    });
    const vendors = await this.vendorNames(notes);
    return notes.map((n) => ({
      id: n.id,
      content: n.content,
      from: (n.vendorOrderId && vendors.get(n.vendorOrderId)) || 'Store',
      createdAt: n.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------- internals
  private async create(
    orderId: string,
    vendorOrderId: string | null,
    input: OrderNoteInput,
    actorId: string,
  ): Promise<OrderNote> {
    const content = input.content.trim();
    if (!content) throw new BadRequestException('Write the note');
    const note = await this.prisma.orderNote.create({
      data: {
        orderId,
        vendorOrderId,
        authorId: actorId,
        content,
        isCustomerVisible: input.isCustomerVisible,
      },
    });
    await this.audit.log({
      actorId,
      action: 'order.note.add',
      entityType: 'Order',
      entityId: orderId,
      after: { noteId: note.id, isCustomerVisible: note.isCustomerVisible },
    });
    return note;
  }

  private async remove(note: OrderNote, actorId: string): Promise<void> {
    await this.prisma.orderNote.delete({ where: { id: note.id } });
    await this.audit.log({
      actorId,
      action: 'order.note.delete',
      entityType: 'Order',
      entityId: note.orderId,
      before: { content: note.content },
    });
  }

  private async orderOrThrow(orderId: string): Promise<void> {
    if (!(await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })))
      throw new NotFoundException('Order not found');
  }

  private async vendorOrderOf(userId: string, vendorOrderId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: ownedOrStaffed(userId),
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor) throw new NotFoundException('No store is linked to this account');
    const vo = await this.prisma.vendorOrder.findFirst({
      where: { id: vendorOrderId, vendorId: vendor.id },
    });
    if (!vo) throw new NotFoundException('Order not found');
    return vo;
  }

  private async vendorNames(notes: OrderNote[]): Promise<Map<string, string>> {
    const ids = [
      ...new Set(notes.map((n) => n.vendorOrderId).filter((v): v is string => Boolean(v))),
    ];
    if (!ids.length) return new Map();
    const vos = await this.prisma.vendorOrder.findMany({
      where: { id: { in: ids } },
      select: { id: true, vendor: { select: { name: true, ownerId: true } } },
    });
    return new Map(vos.map((v) => [v.id, v.vendor.name]));
  }

  private async toDtos(
    notes: OrderNote[],
    canDelete: (n: OrderNote) => boolean,
    _viewerId: string,
  ): Promise<OrderNoteDto[]> {
    const authorIds = [
      ...new Set(notes.map((n) => n.authorId).filter((v): v is string => Boolean(v))),
    ];
    const vendorOrderIds = [
      ...new Set(notes.map((n) => n.vendorOrderId).filter((v): v is string => Boolean(v))),
    ];
    const [users, vos] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.vendorOrder.findMany({
        where: { id: { in: vendorOrderIds } },
        select: {
          id: true,
          vendor: { select: { name: true, ownerId: true, staff: { select: { userId: true } } } },
        },
      }),
    ]);
    const userName = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    const voMap = new Map(vos.map((v) => [v.id, v.vendor]));
    return notes.map((n) => {
      const vendor = n.vendorOrderId ? voMap.get(n.vendorOrderId) : undefined;
      const seller = Boolean(
        vendor &&
        n.authorId &&
        (vendor.ownerId === n.authorId || vendor.staff.some((s) => s.userId === n.authorId)),
      );
      return {
        id: n.id,
        content: n.content,
        isCustomerVisible: n.isCustomerVisible,
        vendorOrderId: n.vendorOrderId,
        vendorName: vendor?.name ?? null,
        author: {
          name: (n.authorId && userName.get(n.authorId)) || 'Unknown',
          kind: seller ? 'SELLER' : 'STAFF',
        },
        createdAt: n.createdAt.toISOString(),
        canDelete: canDelete(n),
      };
    });
  }
}
