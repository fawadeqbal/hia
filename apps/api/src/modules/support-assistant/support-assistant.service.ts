import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Response as ExpressResponse } from 'express';
import type {
  JwtPayload,
  SupportConversation,
  SupportFeedback,
  SupportMessage,
  SupportSource,
} from '@ecommerce/types';
import type { SupportChatDto } from './dto/support-assistant.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable UUID for a signed-in customer, so their chats follow them across devices. */
export function customerVisitorId(userId: string): string {
  const h = createHash('sha256').update(`support:${userId}`).digest('hex');
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Who is chatting: a signed-in customer, or a guest browser (visitor id). */
export interface SupportCaller {
  user?: JwtPayload;
  visitorId?: string;
  ip?: string;
}

interface RawConversation {
  id: string;
  title: string;
  updated_at: string;
}

interface RawMessage {
  id: number;
  role: SupportMessage['role'];
  content: string;
  sources: SupportSource[] | null;
  feedback: SupportFeedback;
  author?: string | null;
  created_at: string;
}

/**
 * Proxy to the support assistant (services/support-ai). The service is internal: only this API calls it,
 * with a shared key, and passes the customer's id so its tools only read that customer's orders.
 */
@Injectable()
export class SupportAssistantService {
  private readonly base: string;
  private readonly key: string;

  constructor(config: ConfigService) {
    this.base = (config.get<string>('SUPPORT_AI_URL') ?? 'http://localhost:5000').replace(
      /\/$/,
      '',
    );
    this.key = config.get<string>('SUPPORT_AI_KEY') ?? '';
  }

  private headers(caller: SupportCaller): Record<string, string> {
    const visitor = caller.user ? customerVisitorId(caller.user.sub) : caller.visitorId;
    if (!visitor || !UUID.test(visitor)) throw new BadRequestException('Missing visitor id');
    return {
      'Content-Type': 'application/json',
      'X-Service-Key': this.key,
      'X-Visitor-Id': visitor,
      'X-Customer-Id': caller.user?.sub ?? '',
      'X-Customer-Email': caller.user?.email ?? '',
      'X-Real-IP': caller.ip ?? '',
    };
  }

  private async call(
    path: string,
    caller: SupportCaller,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = this.headers(caller);
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, { ...init, headers });
    } catch {
      throw new ServiceUnavailableException(
        'The support assistant is offline. Please try again shortly.',
      );
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new HttpException(
        body.error ?? 'The support assistant could not answer.',
        res.status >= 500 ? 503 : res.status,
      );
    }
    return res;
  }

  async conversations(caller: SupportCaller): Promise<SupportConversation[]> {
    const rows = (await (
      await this.call('/api/conversations', caller)
    ).json()) as RawConversation[];
    return rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
  }

  async messages(caller: SupportCaller, id: string): Promise<SupportMessage[]> {
    const path = `/api/conversations/${encodeURIComponent(id)}/messages`;
    const rows = (await (await this.call(path, caller)).json()) as RawMessage[];
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources ?? [],
      feedback: m.feedback ?? null,
      author: m.author ?? null,
      createdAt: m.created_at,
    }));
  }

  async deleteConversation(caller: SupportCaller, id: string): Promise<void> {
    await this.call(`/api/conversations/${encodeURIComponent(id)}`, caller, { method: 'DELETE' });
  }

  async feedback(caller: SupportCaller, messageId: number, value: SupportFeedback): Promise<void> {
    await this.call(`/api/messages/${messageId}/feedback`, caller, {
      method: 'POST',
      body: JSON.stringify({ value: value ?? null }),
    });
  }

  /** Pipes the assistant's Server-Sent Events to the browser. Errors before the first byte become normal API errors. */
  async streamChat(
    caller: SupportCaller,
    dto: SupportChatDto,
    res: ExpressResponse,
  ): Promise<void> {
    const upstream = await this.call('/api/chat/stream', caller, {
      method: 'POST',
      body: JSON.stringify({ conversation_id: dto.conversationId ?? null, message: dto.message }),
    });
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const reader = upstream.body!.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: 'The answer was interrupted. Please try again.' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }
}
