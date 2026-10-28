/** BullMQ queue names. Producers live in apps/api, consumers in apps/worker. */
export const QUEUE_NAMES = {
  EMAIL: 'email',
  MARKETING: 'marketing',
  REPORTS: 'reports',
  IMPORTS: 'imports',
  MEDIA: 'media',
  MAINTENANCE: 'maintenance',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
