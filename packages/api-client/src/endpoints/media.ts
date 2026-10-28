import type { MediaDto, MediaFolder, Paginated } from '@ecommerce/types';
import { api } from '../http';

export const mediaApi = {
  /** Uploads one image. Returns the stored media record (use `.url`). */
  upload: (file: File, folder: MediaFolder = 'general', altText?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    if (altText) form.append('altText', altText);
    return api<MediaDto>('/media', { method: 'POST', body: form });
  },

  /** Convenience for forms that only store the URL. */
  uploadUrl: async (file: File, folder: MediaFolder = 'general') =>
    (await mediaApi.upload(file, folder)).url,

  list: (params: { page?: number; limit?: number; folder?: MediaFolder } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.folder) qs.set('folder', params.folder);
    const query = qs.toString();
    return api<Paginated<MediaDto>>(`/media${query ? `?${query}` : ''}`);
  },

  remove: (id: string) => api<void>(`/media/${id}`, { method: 'DELETE' }),
};
