import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  fromCents,
  toCents,
  type PaymentMethod,
  type PaymentStatus,
  type ShippingAddress,
} from '@ecommerce/types';
import { formatMoney } from '../../../common/utils/money';
import { readSetting } from '../../../common/utils/settings';
import { PrismaService } from '../../../prisma/prisma.service';
import { renderInvoices, renderPackingSlips, type InvoiceData, type PackingSlipData } from './pdf';

const docInclude = {
  vendorOrders: {
    orderBy: { createdAt: 'asc' },
    include: { items: { orderBy: { id: 'asc' } } },
  },
} satisfies Prisma.OrderInclude;
type DocOrder = Prisma.OrderGetPayload<{ include: typeof docInclude }>;
type DocVendorOrder = DocOrder['vendorOrders'][number];

export interface PdfFile {
  filename: string;
  buffer: Buffer;
}

/**
 * Invoice and packing-slip PDFs, numbered INV-<order>-<n> and recorded in `Invoice` the first time
 * one is issued.
 */
@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async customerInvoice(userId: string, orderNumber: string): Promise<PdfFile> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: docInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.invoicePdf(order, order.vendorOrders);
  }

  async adminInvoice(orderId: string): Promise<PdfFile> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: docInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.invoicePdf(order, order.vendorOrders);
  }

  async adminPackingSlip(orderId: string): Promise<PdfFile> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: docInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    const vos = order.vendorOrders.filter((v) => v.status !== 'CANCELLED');
    const store = String(await readSetting(this.prisma, 'store.name', 'HIA Furniture Solutions'));
    return {
      filename: `packing-slip-${order.orderNumber}.pdf`,
      buffer: await renderPackingSlips(vos.map((v) => this.slip(order, v, store))),
    };
  }

  // ---------------------------------------------------------------- internals
  private async invoicePdf(order: DocOrder, vos: DocVendorOrder[]): Promise<PdfFile> {
    if (order.status === 'PENDING_PAYMENT')
      throw new BadRequestException('The invoice is available once the order is paid');
    const billable = vos.filter((v) => v.status !== 'CANCELLED');
    if (billable.length === 0)
      throw new BadRequestException('There is nothing to invoice (cancelled)');
    const store = {
      name: String(await readSetting(this.prisma, 'store.name', 'HIA Furniture Solutions')),
      address: String((await readSetting(this.prisma, 'store.address', '')) || '') || null,
      email: String((await readSetting(this.prisma, 'store.supportEmail', '')) || '') || null,
      phone: String((await readSetting(this.prisma, 'store.phone', '')) || '') || null,
    };
    const pages: InvoiceData[] = [];
    for (const vo of billable) {
      const index = order.vendorOrders.findIndex((v) => v.id === vo.id) + 1;
      pages.push(await this.invoiceData(order, vo, index, store));
    }
    const name =
      billable.length === 1 && vos.length === 1 ? pages[0]!.number : `invoice-${order.orderNumber}`;
    return { filename: `${name}.pdf`, buffer: await renderInvoices(pages) };
  }

  private async invoiceData(
    order: DocOrder,
    vo: DocVendorOrder,
    index: number,
    store: InvoiceData['store'],
  ): Promise<InvoiceData> {
    const money = (n: number) => formatMoney(n, order.currency);
    const paid = fromCents(
      toCents(Number(vo.subtotal)) +
        toCents(Number(vo.shippingTotal)) -
        toCents(Number(vo.discountTotal)),
    );
    const number = `INV-${order.orderNumber.replace(/^ORD-/, '')}-${index}`;
    const invoice = await this.prisma.invoice.upsert({
      where: { vendorOrderId: vo.id },
      update: {},
      create: { orderId: order.id, vendorOrderId: vo.id, number, total: paid },
    });
    const a = order.shippingAddress as unknown as ShippingAddress;
    const totals: InvoiceData['totals'] = [
      { label: 'Items', value: money(Number(vo.subtotal)) },
      { label: 'Shipping', value: money(Number(vo.shippingTotal)) },
    ];
    if (Number(vo.discountTotal) > 0)
      totals.push({ label: 'Discount', value: `-${money(Number(vo.discountTotal))}` });
    totals.push({ label: 'Total', value: money(paid), strong: true });
    return {
      number: invoice.number,
      issuedAt: invoice.issuedAt,
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      store,
      billTo: [
        a.fullName,
        a.line1,
        a.line2 ?? '',
        [a.city, a.state].filter(Boolean).join(', '),
        [a.postalCode, a.countryCode].filter(Boolean).join(' '),
        a.phone,
        order.email,
      ],
      payment: `${PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]} · ${PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus]}`,
      lines: vo.items.map((i) => ({
        name: `${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`,
        sku: i.sku,
        qty: i.quantity,
        unit: money(Number(i.unitPrice)),
        total: money(Number(i.total)),
      })),
      totals,
      notes: ['Thank you for shopping with us.'],
    };
  }

  private slip(order: DocOrder, vo: DocVendorOrder, store: string): PackingSlipData {
    const a = order.shippingAddress as unknown as ShippingAddress;
    return {
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      seller: store,
      shipTo: [
        a.fullName,
        a.line1,
        a.line2 ?? '',
        [a.city, a.state].filter(Boolean).join(', '),
        [a.postalCode, a.countryCode].filter(Boolean).join(' '),
        a.phone,
      ],
      shippingMethod: vo.shippingMethod,
      lines: vo.items.map((i) => ({
        name: `${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`,
        sku: i.sku,
        qty: i.quantity,
      })),
      customerNote: order.customerNote,
    };
  }
}
