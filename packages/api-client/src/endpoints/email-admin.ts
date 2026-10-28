import type {
  EmailLogItem,
  EmailLogQuery,
  EmailPreviewDto,
  EmailSuppressionDto,
  EmailTemplateDetail,
  EmailTemplateInput,
  EmailTemplateListItem,
  Paginated,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const P = '/admin/settings/emails';

/** Admin → Settings → Email templates: editor, preview, test send, log, suppression list. */
export const emailAdminApi = {
  templates: () => api<EmailTemplateListItem[]>(`${P}/templates`),
  template: (key: string) => api<EmailTemplateDetail>(`${P}/templates/${encodeURIComponent(key)}`),
  saveTemplate: (key: string, body: EmailTemplateInput) =>
    api<EmailTemplateDetail>(`${P}/templates/${encodeURIComponent(key)}`, { method: 'PUT', body }),
  resetTemplate: (key: string) =>
    api<EmailTemplateDetail>(`${P}/templates/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  preview: (key: string, body: EmailTemplateInput) =>
    api<EmailPreviewDto>(`${P}/templates/${encodeURIComponent(key)}/preview`, {
      method: 'POST',
      body,
    }),
  sendTest: (key: string, email: string) =>
    api<{ message: string }>(`${P}/templates/${encodeURIComponent(key)}/test`, {
      method: 'POST',
      body: { email },
    }),
  logs: (params: EmailLogQuery = {}) => api<Paginated<EmailLogItem>>(`${P}/log${toQuery(params)}`),
  suppressions: () => api<EmailSuppressionDto[]>(`${P}/suppressions`),
  addSuppression: (email: string) =>
    api<EmailSuppressionDto>(`${P}/suppressions`, { method: 'POST', body: { email } }),
  removeSuppression: (id: string) => api<void>(`${P}/suppressions/${id}`, { method: 'DELETE' }),
};
