import { ownedOrStaffed } from '../../common/utils/vendor-scope';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  RETURN_NOTE_MIN,
  RETURN_REASON_LABELS,
  fromCents,
  toCents,
  type EmailJobPayload,
  type Paginated,
  type ReturnAction,
  type ReturnListItem,
  type ReturnRequestDto,
  type ReturnStatus,
  type ShippingAddress,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { formatMoney } from '../../common/utils/money';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import type {
  CreateReturnDto,
  ReceiveReturnDto,
  RefundReturnDto,
  ReturnDecisionDto,
  ReturnQueryDto,
} from './dto/return.dto';
import {
  refundableForItems,
  returnInclude,
  toReturnDto,
  toReturnListItem,
  type ReturnRow,
} from './return.mapper';
import {
  OPEN_RETURN_STATUSES,
  RETURN_TRANSITIONS,
  generateRmaNumber,
  returnDeadline,
  returnableQuantity,
} from './return-rules';

type ListParams = Pick<ReturnQueryDto, 'page' | 'limit' | 'status' | 'search'>;
/** Seller sees returns of its own sub-orders; admin (vendorId undefined) sees all. */
type Scope = { vendorId?: string; actorId: string };

/**
 * Returns (RMA). One request = items of one delivered seller sub-order, within `returns.windowDays`.
 *   REQUESTED ─approve─► APPROVED ─receive (restock)─► ITEMS_RECEIVED ─refund─► REFUNDED
 *       ├─reject─► REJECTED            (customer may withdraw while REQUESTED → CLOSED)
 * Refund: gateway for online payments; COD is paid back by hand and recorded with a reference.
 */
@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  windowDays(): Promise<number> {
    return readSetting(this.prisma, 'returns.windowDays', 7);
  }

  // ================================================================ customer

  async listMine(userId: string, q: ListParams): Promise<Paginated<ReturnListItem>> {
    return this.list({ userId, ...(q.status ? { status: q.status } : {}) }, q);
  }

  async getMine(userId: string, rmaNumber: string): Promise<ReturnRequestDto> {
    const row = await this.prisma.returnRequest.findFirst({
      where: { rmaNumber: rmaNumber.toUpperCase(), userId },
      include: returnInclude,
    });
    if (!row) throw new NotFoundException('Return not found');
    return toReturnDto(row);
  }

  async create(userId: string, dto: CreateReturnDto): Promise<ReturnRequestDto> {
    const vo = await this.prisma.vendorOrder.findFirst({
      where: {
        id: dto.vendorOrderId,
        order: { orderNumber: dto.orderNumber.toUpperCase(), userId },
      },
      include: {
        order: true,
        vendor: { select: { id: true, name: true, email: true, ownerId: true } },
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        items: {
          include: {
            returnItems: {
              where: { returnRequest: { status: { in: OPEN_RETURN_STATUSES } } },
              select: { quantity: true },
            },
          },
        },
      },
    });
    if (!vo) throw new NotFoundException('Order not found');
    if (vo.status !== 'DELIVERED')
      throw new BadRequestException('Items can be returned once they are delivered');
    const deadline = returnDeadline(
      vo.shipments[0]?.deliveredAt ?? vo.updatedAt,
      await this.windowDays(),
    );
    if (!deadline || deadline < new Date())
      throw new BadRequestException('The return window for this order has closed');

    const seen = new Set<string>();
    const lines = dto.items.map((line) => {
      if (seen.has(line.orderItemId)) throw new BadRequestException('Each item can be listed once');
      seen.add(line.orderItemId);
      const item = vo.items.find((i) => i.id === line.orderItemId);
      if (!item) throw new BadRequestException('An item does not belong to this order');
      const left = returnableQuantity(
        item.quantity,
        item.returnItems.reduce((n, r) => n + r.quantity, 0),
      );
      if (line.quantity > left)
        throw new BadRequestException(`"${item.productName}": you can return at most ${left}`);
      return line;
    });

    let created: ReturnRow | null = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        created = await this.prisma.returnRequest.create({
          data: {
            rmaNumber: generateRmaNumber(),
            orderId: vo.orderId,
            vendorOrderId: vo.id,
            userId,
            reason: dto.reason,
            comments: dto.comments || null,
            items: {
              create: lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })),
            },
          },
          include: returnInclude,
        });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error; // rare RMA collision → retry
      }
    }
    if (!created) throw new ConflictException('Could not create the return, please try again');

    await this.audit.log({
      actorId: userId,
      action: 'return.request',
      entityType: 'ReturnRequest',
      entityId: created.id,
      after: { rmaNumber: created.rmaNumber, items: lines },
    });
    const dtoOut = toReturnDto(created);
    await this.email(created, EmailTemplateKey.RETURN_RECEIVED, {
      heading: `Return ${created.rmaNumber} received`,
      body: `We received your return request for order ${dtoOut.orderNumber}. ${vo.vendor.name} will review it shortly.`,
    });
    await this.emailVendor(vo.vendor, created, dtoOut);
    return dtoOut;
  }

  async cancelMine(userId: string, rmaNumber: string): Promise<ReturnRequestDto> {
    const row = await this.prisma.returnRequest.findFirst({
      where: { rmaNumber: rmaNumber.toUpperCase(), userId },
    });
    if (!row) throw new NotFoundException('Return not found');
    const { count } = await this.prisma.returnRequest.updateMany({
      where: { id: row.id, status: 'REQUESTED' },
      data: { status: 'CLOSED', decisionNote: 'Withdrawn by the customer' },
    });
    if (count === 0) throw new BadRequestException('This return can no longer be withdrawn');
    await this.audit.log({
      actorId: userId,
      action: 'return.withdraw',
      entityType: 'ReturnRequest',
      entityId: row.id,
    });
    return this.getMine(userId, rmaNumber);
  }

  // ================================================================ seller / admin

  async staffList(scope: Scope, q: ListParams): Promise<Paginated<ReturnListItem>> {
    const search = q.search?.toUpperCase();
    return this.list(
      {
        ...this.scopeWhere(scope),
        ...(q.status ? { status: q.status } : {}),
        ...(search
          ? {
              OR: [
                { rmaNumber: { contains: search } },
                { order: { orderNumber: { contains: search } } },
              ],
            }
          : {}),
      },
      q,
    );
  }

  async staffGet(scope: Scope, id: string): Promise<ReturnRequestDto> {
    return toReturnDto(await this.findScoped(scope, id));
  }

  async approve(scope: Scope, id: string, dto: ReturnDecisionDto): Promise<ReturnRequestDto> {
    const row = await this.transition(scope, id, 'approve', { decisionNote: dto.note || null });
    await this.email(row, EmailTemplateKey.RETURN_APPROVED, {
      heading: `Return ${row.rmaNumber} approved`,
      body: [
        `Your return for order ${row.order.orderNumber} was approved. Please send the items back to the seller; your refund is issued once they arrive.`,
        dto.note ? `Note from the seller: ${dto.note}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
    return toReturnDto(row);
  }

  async reject(scope: Scope, id: string, dto: ReturnDecisionDto): Promise<ReturnRequestDto> {
    if ((dto.note?.length ?? 0) < RETURN_NOTE_MIN)
      throw new BadRequestException('Tell the customer why the return is rejected');
    const row = await this.transition(scope, id, 'reject', { decisionNote: dto.note });
    await this.email(row, EmailTemplateKey.RETURN_REJECTED, {
      heading: `Update on return ${row.rmaNumber}`,
      body: `Your return for order ${row.order.orderNumber} was not accepted. Reason: ${dto.note}`,
    });
    return toReturnDto(row);
  }

  /** Items arrived: record their condition; restocked ones go back to the warehouse they shipped from. */
  async receive(scope: Scope, id: string, dto: ReceiveReturnDto): Promise<ReturnRequestDto> {
    const current = await this.findScoped(scope, id);
    if (current.status !== 'APPROVED')
      throw new BadRequestException('Only approved returns can be marked as received');
    const byId = new Map(dto.items.map((i) => [i.returnItemId, i]));
    if (current.items.some((i) => !byId.has(i.id)) || dto.items.length !== current.items.length)
      throw new BadRequestException('Confirm every returned item');

    const row = await this.transition(scope, id, 'receive', {});
    for (const item of current.items) {
      const line = byId.get(item.id)!;
      await this.prisma.returnItem.update({
        where: { id: item.id },
        data: { condition: line.condition || null, restocked: line.restock },
      });
      if (line.restock) {
        const warehouseId = await this.restockWarehouse(
          item.orderItem.variantId,
          row.order.orderNumber,
        );
        if (warehouseId) {
          await this.inventory.applyChange({
            variantId: item.orderItem.variantId,
            warehouseId,
            delta: item.quantity,
            type: 'RETURN',
            reference: row.rmaNumber,
            note: `Return ${row.rmaNumber}${line.condition ? ` (${line.condition})` : ''}`,
            actorId: scope.actorId,
          });
        } else {
          this.logger.warn(`No warehouse to restock ${item.orderItem.sku} for ${row.rmaNumber}`);
        }
      }
    }
    return this.staffGet(scope, id);
  }

  async refund(scope: Scope, id: string, dto: RefundReturnDto): Promise<ReturnRequestDto> {
    const current = await this.findScoped(scope, id);
    if (current.status !== 'ITEMS_RECEIVED')
      throw new BadRequestException('Refund once the returned items have been received');
    const vo = current.vendorOrderId
      ? await this.prisma.vendorOrder.findUnique({
          where: { id: current.vendorOrderId },
          select: { shippingTotal: true },
        })
      : null;
    // Paid for the items (after discounts, plus added tax) + the sub-order's shipping.
    const max = fromCents(
      toCents(refundableForItems(current)) + toCents(Number(vo?.shippingTotal ?? 0)),
    );
    if (toCents(dto.amount) > toCents(max))
      throw new BadRequestException(
        `At most ${formatMoney(max, current.order.currency)} (items, tax + shipping)`,
      );
    if (current.order.paymentMethod === 'COD' && !dto.reference)
      throw new BadRequestException('Enter the reference of the bank transfer / cash refund');

    const ok = await this.payments.refundForReturn(
      current.orderId,
      dto.amount,
      `Return ${current.rmaNumber}: ${RETURN_REASON_LABELS[current.reason as keyof typeof RETURN_REASON_LABELS] ?? current.reason}`,
      current.id,
      scope.actorId,
      dto.reference,
    );
    if (!ok)
      throw new BadRequestException('The payment gateway refused the refund. Try again later.');
    await this.transition(scope, id, 'refund', {
      refundAmount: dto.amount,
      refundedAt: new Date(),
    });
    return this.staffGet(scope, id);
  }

  // ================================================================ helpers

  private async list(
    where: Prisma.ReturnRequestWhereInput,
    q: ListParams,
  ): Promise<Paginated<ReturnListItem>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.returnRequest.findMany({
        where,
        include: returnInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.returnRequest.count({ where }),
    ]);
    return paginate(rows.map(toReturnListItem), total, q.page, q.limit);
  }

  private scopeWhere(scope: Scope): Prisma.ReturnRequestWhereInput {
    return scope.vendorId
      ? { items: { some: { orderItem: { vendorOrder: { vendorId: scope.vendorId } } } } }
      : {};
  }

  private async findScoped(scope: Scope, id: string): Promise<ReturnRow> {
    const row = await this.prisma.returnRequest.findFirst({
      where: { id, ...this.scopeWhere(scope) },
      include: returnInclude,
    });
    if (!row) throw new NotFoundException('Return not found');
    return row;
  }

  /** Moves the status only if it is still in the expected one (a double click cannot apply twice). */
  private async transition(
    scope: Scope,
    id: string,
    action: ReturnAction,
    data: Prisma.ReturnRequestUpdateManyMutationInput,
  ): Promise<ReturnRow> {
    const current = await this.findScoped(scope, id);
    const { from, to } = RETURN_TRANSITIONS[action];
    const { count } = await this.prisma.returnRequest.updateMany({
      where: { id, status: from },
      data: { ...data, status: to },
    });
    if (count === 0)
      throw new BadRequestException(
        `This return is "${current.status.toLowerCase().replace('_', ' ')}" and cannot be ${action}d`,
      );
    await this.audit.log({
      actorId: scope.actorId,
      action: `return.${action}`,
      entityType: 'ReturnRequest',
      entityId: id,
      before: { status: current.status },
      after: { status: to as ReturnStatus, ...data },
    });
    return this.findScoped(scope, id);
  }

  /** The warehouse the unit shipped from (SALE movement of the order), else any warehouse holding the variant. */
  private async restockWarehouse(variantId: string, orderNumber: string): Promise<string | null> {
    const sale = await this.prisma.stockMovement.findFirst({
      where: { variantId, reference: orderNumber, type: 'SALE' },
      select: { warehouseId: true },
    });
    if (sale?.warehouseId) return sale.warehouseId;
    const level = await this.prisma.stockLevel.findFirst({
      where: { variantId, warehouse: { isActive: true } },
      select: { warehouseId: true },
    });
    return level?.warehouseId ?? null;
  }

  private async email(
    row: ReturnRow,
    template: EmailJobPayload['template'],
    data: { heading: string; body: string },
  ) {
    try {
      const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
      const address = row.order.shippingAddress as unknown as ShippingAddress;
      await this.notifications.sendEmail({
        template,
        to: row.order.email,
        userId: row.userId ?? undefined,
        data: {
          ...data,
          firstName: address.fullName.split(' ')[0],
          ctaLabel: 'View return',
          ctaUrl: `${site}/account/returns/${row.rmaNumber}`,
        },
      });
    } catch (error) {
      this.logger.error(`Return email failed for ${row.rmaNumber}: ${String(error)}`);
    }
  }

  private async emailVendor(
    vendor: { email: string; ownerId: string },
    row: ReturnRow,
    dto: ReturnRequestDto,
  ) {
    try {
      const vendorApp = this.config.get<string>('NEXT_PUBLIC_VENDOR_URL', 'http://localhost:3002');
      await this.notifications.sendEmail({
        template: EmailTemplateKey.VENDOR_RETURN_REQUEST,
        to: vendor.email,
        userId: vendor.ownerId,
        data: {
          heading: `Return request ${row.rmaNumber}`,
          body: `${dto.items.reduce((n, i) => n + i.quantity, 0)} item(s) from order ${dto.orderNumber}. Reason: ${RETURN_REASON_LABELS[dto.reason]}.`,
          ctaLabel: 'Review return',
          ctaUrl: `${vendorApp}/returns/${row.id}`,
        },
      });
    } catch (error) {
      this.logger.error(`Vendor return email failed for ${row.rmaNumber}: ${String(error)}`);
    }
  }

  /** Seller account → its store (approved or suspended stores can still handle returns). */
  async vendorScope(userId: string): Promise<Scope> {
    const vendor = await this.prisma.vendor.findFirst({
      where: ownedOrStaffed(userId),
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor) throw new NotFoundException('No store is linked to this account');
    if (vendor.status === 'PENDING' || vendor.status === 'REJECTED')
      throw new ForbiddenException('Your store is not approved');
    return { vendorId: vendor.id, actorId: userId };
  }
}
