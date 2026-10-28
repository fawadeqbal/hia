import { ApiClientError } from './http';

/** TanStack Query retry policy: never retry 4xx (auth, validation, not found); retry other errors twice. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiClientError && error.status < 500) return false;
  return failureCount < 2;
}
