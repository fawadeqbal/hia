import {
  SUPPORT_VISITOR_HEADER,
  type SupportChatInput,
  type SupportConversation,
  type SupportFeedback,
  type SupportMessage,
  type SupportStreamEvent,
} from '@ecommerce/types';
import { api, ApiClientError, API_URL } from '../http';

const base = '/support/assistant';
const visitor = (visitorId: string) => ({ [SUPPORT_VISITOR_HEADER]: visitorId });

/** Reads a Server-Sent Events body and calls onEvent for each event. */
async function readEvents(res: Response, onEvent: (e: SupportStreamEvent) => void): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (data) onEvent({ event, data: JSON.parse(data) } as SupportStreamEvent);
    }
  }
}

/** Support assistant chat. `visitorId` identifies a guest's browser (ignored for signed-in customers). */
export const supportAssistantApi = {
  conversations: (visitorId: string) =>
    api<SupportConversation[]>(`${base}/conversations`, { headers: visitor(visitorId) }),
  messages: (visitorId: string, id: string) =>
    api<SupportMessage[]>(`${base}/conversations/${encodeURIComponent(id)}/messages`, {
      headers: visitor(visitorId),
    }),
  deleteConversation: (visitorId: string, id: string) =>
    api<void>(`${base}/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: visitor(visitorId),
    }),
  feedback: (visitorId: string, messageId: number, value: SupportFeedback) =>
    api<void>(`${base}/messages/${messageId}/feedback`, {
      method: 'POST',
      body: { value },
      headers: visitor(visitorId),
    }),
  /** Streams the answer; resolves when the stream ends. Throws ApiClientError when the request is refused. */
  async chat(
    visitorId: string,
    body: SupportChatInput,
    onEvent: (e: SupportStreamEvent) => void,
  ): Promise<void> {
    const res = await fetch(`${API_URL}${base}/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...visitor(visitorId) },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      throw new ApiClientError(res.status, await res.json().catch(() => undefined));
    }
    await readEvents(res, onEvent);
  },
};
