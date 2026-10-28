import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrderNote } from '@ecommerce/database';
import type { CustomerOrderNoteDto, OrderNoteDto, OrderNoteInput } from '@ecommerce/types';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

/** Order notes written by the admin. The customer sees only the notes marked visible. */
@Injectable()
export class OrderNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async adminList(orderId: string): Promise<OrderNoteDto[]> {
    await this.orderOrThrow(orderId);
    const notes = await this.prisma.orderNote.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return this.toDtos(notes);
  }

  async adminAdd(orderId: string, input: OrderNoteInput, actorId: string): Promise<OrderNoteDto> {
    await this.orderOrThrow(orderId);
    const content = input.content.trim();
    if (!content) throw new BadRequestException('Write the note');
    const note = await this.prisma.orderNote.create({
      data: { orderId, authorId: actorId, content, isCustomerVisible: input.isCustomerVisible },
    });
    await this.audit.log({
      actorId,
      action: 'order.note.add',
      entityType: 'Order',
      entityId: orderId,
      after: { noteId: note.id, isCustomerVisible: note.isCustomerVisible },
    });
    return (await this.toDtos([note]))[0]!;
  }

  async adminRemove(orderId: string, noteId: string, actorId: string): Promise<void> {
    const note = await this.prisma.orderNote.findFirst({ where: { id: noteId, orderId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.prisma.orderNote.delete({ where: { id: note.id } });
    await this.audit.log({
      actorId,
      action: 'order.note.delete',
      entityType: 'Order',
      entityId: note.orderId,
      before: { content: note.content },
    });
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
    return notes.map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------- internals
  private async orderOrThrow(orderId: string): Promise<void> {
    if (!(await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })))
      throw new NotFoundException('Order not found');
  }

  private async toDtos(notes: OrderNote[]): Promise<OrderNoteDto[]> {
    const authorIds = [
      ...new Set(notes.map((n) => n.authorId).filter((v): v is string => Boolean(v))),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userName = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    return notes.map((n) => ({
      id: n.id,
      content: n.content,
      isCustomerVisible: n.isCustomerVisible,
      author: { name: (n.authorId && userName.get(n.authorId)) || 'Admin' },
      createdAt: n.createdAt.toISOString(),
      canDelete: true,
    }));
  }
}
