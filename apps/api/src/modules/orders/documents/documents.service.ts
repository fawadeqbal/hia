import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { ownedOrStaffed } from '../../../common/utils/vendor-scope';
import { PrismaService } from '../../../prisma/prisma.service';
import { renderInvoices, renderPackingSlips, type InvoiceData, type PackingSlipData } from './pdf';

const docInclude = {
  vendorOrders: {
    orderBy: { createdAt: 'asc' },
    include: { vendor: true, items: { orderBy: { id: 'asc' } } },
  },
} satisfies Prisma.OrderInclude;
type DocOrder = Prisma.OrderGetPayload<{ include: typeof docInclude }>;
type DocVendorOrder = DocOrder['vendorOrders'][number];

/** Sellers see COD orders and online orders that were paid (same rule as their order list). */
const VISIBLE_TO_VENDOR: Prisma.OrderWhereInput = {
  OR: [
    { paymentMethod: 'COD' },
    { paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
  ],
};

export interface PdfFile {
  filename: string;
  buffer: Buffer;
}

/**
 * Invoice and packing-slip PDFs. One invoice per seller sub-order (the seller is the seller of record; the store
 * collects payment), numbered INV-<order>-<n> and recorded in `Invoice` the first time it is issued.
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
    return {
      filename: `packing-slip-${order.orderNumber}.pdf`,
      buffer: await renderPackingSlips(vos.map((v) => this.slip(order, v))),
    };
  }

  async vendorInvoice(userId: string, vendorOrderId: string): Promise<PdfFile> {
    const { order, vo } = await this.vendorScoped(userId, vendorOrderId);
    return this.invoicePdf(order, [vo]);
  }

  async vendorPackingSlip(userId: string, vendorOrderId: string): Promise<PdfFile> {
    const { order, vo } = await this.vendorScoped(userId, vendorOrderId);
    return {
      filename: `packing-slip-${order.orderNumber}.pdf`,
      buffer: await renderPackingSlips([this.slip(order, vo)]),
    };
  }

  // ---------------------------------------------------------------- internals
  private async vendorScoped(
    userId: string,
    vendorOrderId: string,
  ): Promise<{ order: DocOrder; vo: DocVendorOrder }> {
    const vendor = await this.prisma.vendor.findFirst({
      where: ownedOrStaffed(userId),
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor || vendor.status === 'PENDING' || vendor.status === 'REJECTED')
      throw new ForbiddenException('Your store is not approved');
    const order = await this.prisma.order.findFirst({
      where: {
        ...VISIBLE_TO_VENDOR,
        vendorOrders: { some: { id: vendorOrderId, vendorId: vendor.id } },
      },
      include: docInclude,
    });
    const vo = order?.vendorOrders.find((v) => v.id === vendorOrderId);
    if (!order || !vo) throw new NotFoundException('Order not found');
    return { order, vo };
  }

  private async invoicePdf(order: DocOrder, vos: DocVendorOrder[]): Promise<PdfFile> {
    if (order.status === 'PENDING_PAYMENT')
      throw new BadRequestException('The invoice is available once the order is paid');
    const billable = vos.filter((v) => v.status !== 'CANCELLED');
    if (billable.length === 0)
      throw new BadRequestException('There is nothing to invoice (cancelled)');
    const store = {
      name: String(await readSetting(this.prisma, 'store.name', 'Ecommerce')),
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
        toCents(Number(vo.shippingTotal)) +
        toCents(Number(vo.taxAdded)) -
        toCents(Number(vo.discountTotal)),
    );
    const number = `INV-${order.orderNumber.replace(/^ORD-/, '')}-${index}`;
    const invoice = await this.prisma.invoice.upsert({
      where: { vendorOrderId: vo.id },
      update: {},
      create: { orderId: order.id, vendorOrderId: vo.id, number, total: paid },
    });
    const a = order.shippingAddress as unknown as ShippingAddress;
    const taxIncluded = fromCents(toCents(Number(vo.taxTotal)) - toCents(Number(vo.taxAdded)));
    const totals: InvoiceData['totals'] = [
      { label: 'Items', value: money(Number(vo.subtotal)) },
      { label: 'Shipping', value: money(Number(vo.shippingTotal)) },
    ];
    if (Number(vo.discountTotal) > 0)
      totals.push({ label: 'Discounts & credits', value: `-${money(Number(vo.discountTotal))}` });
    if (Number(vo.taxAdded) > 0) totals.push({ label: 'Tax', value: money(Number(vo.taxAdded)) });
    totals.push({ label: 'Total', value: money(paid), strong: true });
    return {
      number: invoice.number,
      issuedAt: invoice.issuedAt,
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      store,
      seller: { name: vo.vendor.name, email: vo.vendor.email, phone: vo.vendor.phone },
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
        tax:
          i.taxRate !== null
            ? `${Math.round(Number(i.taxRate) * 10000) / 100}%${i.taxInclusive ? ' incl.' : ''}`
            : null,
      })),
      totals,
      notes: [
        taxIncluded > 0 ? `Prices include ${money(taxIncluded)} tax.` : '',
        'Sold by the seller named above; payment collected by the marketplace.',
      ].filter(Boolean),
    };
  }

  private slip(order: DocOrder, vo: DocVendorOrder): PackingSlipData {
    const a = order.shippingAddress as unknown as ShippingAddress;
    return {
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      seller: vo.vendor.name,
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
