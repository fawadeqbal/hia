/**
 * Customer-support assistant. The RAG service (services/support-ai) answers; the API proxies it at
 * /support/assistant and tells it who the customer is, so the assistant only sees that customer's orders.
 */
export const SUPPORT_MESSAGE_MAX = 1000;
/** Browser header for guests' chat history (a random UUID kept in localStorage). */
export const SUPPORT_VISITOR_HEADER = 'X-Visitor-Id';
export const SUPPORT_VISITOR_STORAGE_KEY = 'support-visitor-id';

export interface SupportChatInput {
  /** Omit to start a new chat. */
  conversationId?: string | null;
  message: string;
}

export interface SupportSource {
  page: number | null;
  title?: string | null;
  text: string;
  score: number;
}

export interface SupportConversation {
  id: string;
  title: string;
  updatedAt: string;
}

export type SupportFeedback = 'up' | 'down' | null;

export interface SupportMessage {
  id: number;
  role: 'user' | 'assistant' | 'agent' | 'system';
  content: string;
  sources: SupportSource[];
  feedback: SupportFeedback;
  author: string | null;
  createdAt: string;
}

/** Server-sent events of POST /support/assistant/chat (wire format of the assistant service). */
export type SupportStreamEvent =
  | { event: 'step'; data: { name: string; route?: string } }
  | {
      event: 'meta';
      data: {
        conversation_id: string | null;
        route: string;
        query: string;
        sources: SupportSource[];
      };
    }
  | { event: 'tool'; data: { name: string } }
  | { event: 'handoff'; data: { form: boolean } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'done'; data: { conversation_id: string; message_id: number; title: string } }
  | { event: 'error'; data: { error: string } };

export const SUPPORT_SUGGESTIONS = [
  'Where is my order?',
  'What payment methods do you accept?',
  'How do I return a product?',
  'Do you have wireless earbuds in stock?',
];
