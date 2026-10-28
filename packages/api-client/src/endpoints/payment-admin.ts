import type {
  Paginated,
  PaymentGatewayDto,
  PaymentGatewayInput,
  PaymentLogDetail,
  PaymentLogItem,
  PaymentLogQuery,
  WebhookLogDetail,
  WebhookLogItem,
  WebhookLogQuery,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const P = '/admin/settings/payments';

/** Admin → Settings → Payments: gateways, payment log, webhook log. */
export const paymentAdminApi = {
  gateways: () => api<PaymentGatewayDto[]>(`${P}/gateways`),
  saveGateway: (code: string, body: PaymentGatewayInput) =>
    api<PaymentGatewayDto>(`${P}/gateways/${code}`, { method: 'PUT', body }),
  payments: (params: PaymentLogQuery = {}) =>
    api<Paginated<PaymentLogItem>>(`${P}/log${toQuery(params)}`),
  payment: (id: string) => api<PaymentLogDetail>(`${P}/log/${id}`),
  webhooks: (params: WebhookLogQuery = {}) =>
    api<Paginated<WebhookLogItem>>(`${P}/webhooks${toQuery(params)}`),
  webhook: (id: string) => api<WebhookLogDetail>(`${P}/webhooks/${id}`),
};
