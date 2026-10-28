import {
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_STATUS_LABELS,
  INQUIRY_STATUS_LABELS,
  INQUIRY_TOPIC_LABELS,
  MODERATION_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  type AdminOrderListItem,
  type CustomerListItem,
  type InquiryListItem,
  type QuestionDto,
  type ReturnListItem,
  type ReviewDto,
} from '@ecommerce/types';
import { excelDate, yesNo, type ExcelColumn } from './excel';

/** Excel columns for the download-only lists (orders, customers, inquiries, returns, reviews, questions). */

export const orderColumns: ExcelColumn<AdminOrderListItem>[] = [
  { header: 'Order', value: (o) => o.orderNumber, width: 20 },
  { header: 'Date', value: (o) => excelDate(o.placedAt, true), width: 17 },
  { header: 'Customer', value: (o) => o.customerName, width: 24 },
  { header: 'Email', value: (o) => o.email, width: 28 },
  { header: 'City', value: (o) => o.city, width: 16 },
  { header: 'Items', value: (o) => o.itemCount, width: 8 },
  { header: 'Total', value: (o) => o.grandTotal, width: 12 },
  { header: 'Payment', value: (o) => PAYMENT_METHOD_LABELS[o.paymentMethod], width: 18 },
  { header: 'Payment status', value: (o) => PAYMENT_STATUS_LABELS[o.paymentStatus], width: 16 },
  { header: 'Status', value: (o) => ORDER_STATUS_LABELS[o.status], width: 18 },
];

export const customerColumns: ExcelColumn<CustomerListItem>[] = [
  { header: 'Name', value: (c) => c.name, width: 24 },
  { header: 'Email', value: (c) => c.email, width: 28 },
  { header: 'Phone', value: (c) => c.phone ?? '', width: 16 },
  { header: 'Orders', value: (c) => c.orders, width: 9 },
  { header: 'Total spent', value: (c) => c.totalSpent, width: 13 },
  { header: 'Last order', value: (c) => excelDate(c.lastOrderAt), width: 12 },
  { header: 'Joined', value: (c) => excelDate(c.createdAt), width: 12 },
  {
    header: 'Groups',
    value: (c) => c.segments.map((s) => CUSTOMER_SEGMENT_LABELS[s]).join(', '),
    width: 24,
  },
  { header: 'Email verified', value: (c) => yesNo(c.emailVerified), width: 14 },
  { header: 'Status', value: (c) => CUSTOMER_STATUS_LABELS[c.status], width: 12 },
];

export const inquiryColumns: ExcelColumn<InquiryListItem>[] = [
  { header: 'Number', value: (i) => i.number, width: 18 },
  { header: 'Date', value: (i) => excelDate(i.createdAt, true), width: 17 },
  { header: 'Type', value: (i) => INQUIRY_TOPIC_LABELS[i.topic], width: 22 },
  { header: 'Name', value: (i) => i.name, width: 22 },
  { header: 'Phone', value: (i) => i.phone ?? '', width: 16 },
  { header: 'Email', value: (i) => i.email ?? '', width: 26 },
  { header: 'Subject', value: (i) => i.subject, width: 30 },
  { header: 'Message', value: (i) => i.preview, width: 50 },
  { header: 'Status', value: (i) => INQUIRY_STATUS_LABELS[i.status], width: 12 },
];

export const returnColumns: ExcelColumn<ReturnListItem>[] = [
  { header: 'Return', value: (r) => r.rmaNumber, width: 20 },
  { header: 'Date', value: (r) => excelDate(r.createdAt, true), width: 17 },
  { header: 'Order', value: (r) => r.orderNumber, width: 20 },
  { header: 'Customer', value: (r) => r.customerName, width: 24 },
  { header: 'Reason', value: (r) => RETURN_REASON_LABELS[r.reason], width: 22 },
  { header: 'Items', value: (r) => r.itemCount, width: 8 },
  { header: 'Items value', value: (r) => r.itemsTotal, width: 12 },
  { header: 'Status', value: (r) => RETURN_STATUS_LABELS[r.status], width: 16 },
];

export const reviewColumns: ExcelColumn<ReviewDto>[] = [
  { header: 'Date', value: (r) => excelDate(r.createdAt), width: 12 },
  { header: 'Product', value: (r) => r.product.name, width: 32 },
  { header: 'Stars', value: (r) => r.rating, width: 7 },
  { header: 'Title', value: (r) => r.title ?? '', width: 28 },
  { header: 'Review', value: (r) => r.body ?? '', width: 60 },
  { header: 'Customer', value: (r) => r.author, width: 18 },
  { header: 'Verified purchase', value: (r) => yesNo(r.verified), width: 17 },
  { header: 'Status', value: (r) => MODERATION_LABELS[r.status], width: 12 },
];

export const questionColumns: ExcelColumn<QuestionDto>[] = [
  { header: 'Date', value: (q) => excelDate(q.createdAt), width: 12 },
  { header: 'Product', value: (q) => q.product.name, width: 32 },
  { header: 'Question', value: (q) => q.body, width: 50 },
  { header: 'Customer', value: (q) => q.author, width: 18 },
  { header: 'Answer', value: (q) => q.answers.map((a) => a.body).join('\n'), width: 50 },
  { header: 'Status', value: (q) => MODERATION_LABELS[q.status], width: 12 },
];
