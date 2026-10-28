import type {
  InquiryCreatedDto,
  InquiryDto,
  InquiryInput,
  InquiryListItem,
  InquiryNoteInput,
  InquiryStatus,
  InquiryStatusInput,
  InquiryTopic,
  Paginated,
} from '@ecommerce/types';
import { api } from '../http';

export interface InquiryListQuery {
  status?: InquiryStatus;
  topic?: InquiryTopic;
  search?: string;
  page?: number;
  limit?: number;
}

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const ADMIN = '/admin/inquiries';

/** Website contact form (public) + the admin Inquiries inbox. */
export const inquiriesApi = {
  create: (body: InquiryInput) => api<InquiryCreatedDto>('/inquiries', { method: 'POST', body }),
  adminList: (params: InquiryListQuery = {}) =>
    api<Paginated<InquiryListItem>>(`${ADMIN}${toQuery(params)}`),
  adminGet: (id: string) => api<InquiryDto>(`${ADMIN}/${id}`),
  setStatus: (id: string, body: InquiryStatusInput) =>
    api<InquiryDto>(`${ADMIN}/${id}/status`, { method: 'PATCH', body }),
  addNote: (id: string, body: InquiryNoteInput) =>
    api<InquiryDto>(`${ADMIN}/${id}/notes`, { method: 'POST', body }),
};
