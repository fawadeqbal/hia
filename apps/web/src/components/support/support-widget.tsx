'use client';

/**
 * Customer support chat: a slide-out panel opened by the "Support" tab on the right edge.
 * The answer streams from POST /support/assistant/chat (Server-Sent Events: step, meta, tool, delta, done).
 * Guests are identified by a random id kept in this browser; signed-in customers by their account,
 * so the assistant can look up their own orders.
 */
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUGGESTIONS,
  SUPPORT_VISITOR_STORAGE_KEY,
  type SupportConversation,
  type SupportFeedback,
  type SupportMessage,
  type SupportSource,
} from '@ecommerce/types';
import { ApiClientError, supportAssistantApi } from '@/lib/api-client';
import { useMe } from '@/hooks/use-cart';
import { SUPPORT_OPEN_EVENT } from './open-support';

interface ChatMessage {
  id: string;
  serverId?: number;
  role: SupportMessage['role'];
  content: string;
  at?: string;
  /** Assistant only: 0 thinking … 3 writing, 4 done. */
  stage?: number;
  route?: string;
  tool?: string;
  sources?: SupportSource[];
  expanded?: boolean;
  fb?: SupportFeedback;
  error?: boolean;
  author?: string | null;
}

const TRACE_STEPS = [
  'Understanding question',
  'Searching help articles',
  'Ranking passages',
  'Writing answer',
];
const TOOL_LABELS: Record<string, string> = {
  lookup_order: 'Checked your orders',
  search_products: 'Searched the catalog',
  open_support_ticket: 'Asked for a person',
};

/** Store links in answers: same-site URLs become in-app paths. */
function toPath(href: string): string | null {
  if (href.startsWith('/')) return href;
  try {
    const url = new URL(href);
    return url.origin === window.location.origin || url.hostname === 'localhost'
      ? url.pathname + url.search
      : null;
  } catch {
    return null;
  }
}

/** A readable title for a bare store URL the assistant wrote out. */
function linkTitle(path: string): string {
  const order = path.match(/^\/account\/orders\/([^/?#]+)/);
  if (order) return `View order ${decodeURIComponent(order[1]!)}`;
  if (path.startsWith('/account/returns')) return 'View your return';
  if (path.startsWith('/products/')) return 'View product';
  if (path.startsWith('/track-order')) return 'Track your order';
  return 'Open page';
}

/** Bare http(s) URLs -> [title](url) so they render as named links. */
function nameBareLinks(text: string): string {
  return text.replace(
    /(^|\s)(https?:\/\/[^\s)\]]+[^\s)\].,;:!?])/g,
    (_, lead: string, url: string) => {
      const path = toPath(url);
      return `${lead}[${path ? linkTitle(path) : url}](${url})`;
    },
  );
}

let memoryVisitorId: string | null = null;
function visitorId(): string {
  try {
    let id = localStorage.getItem(SUPPORT_VISITOR_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SUPPORT_VISITOR_STORAGE_KEY, id);
    }
    return id;
  } catch {
    memoryVisitorId ??= crypto.randomUUID(); // storage blocked: this visit only
    return memoryVisitorId;
  }
}

function clock(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

const fromServer = (m: SupportMessage): ChatMessage => ({
  id: `s${m.id}`,
  serverId: m.id,
  role: m.role,
  content: m.content,
  at: m.createdAt,
  stage: 4,
  sources: m.sources,
  fb: m.feedback,
  author: m.author,
});

function errorText(err: unknown): string {
  if (err instanceof ApiClientError) {
    return err.status >= 500
      ? 'The assistant is offline right now. Please try again in a moment.'
      : err.message;
  }
  return 'The assistant is offline right now. Please try again in a moment.';
}

const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
const Icon = {
  chat: (
    <svg {...iconProps}>
      <path
        d="M4 5h16v11H9l-5 4V5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  history: (
    <svg {...iconProps}>
      <path
        d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  plus: (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  back: (
    <svg {...iconProps}>
      <path
        d="M15 5l-7 7 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  send: (
    <svg {...iconProps}>
      <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor" />
    </svg>
  ),
  up: (
    <svg {...iconProps} width={15} height={15}>
      <path
        d="M7 10v10H4V10h3zm0 0l4-7c1.5 0 2.5 1 2.2 2.6L12.6 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
  down: (
    <svg {...iconProps} width={15} height={15}>
      <path
        d="M17 14V4h3v10h-3zm0 0l-4 7c-1.5 0-2.5-1-2.2-2.6l.6-3.4H5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.2 4H17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function IconButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      title={props.label}
      className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

function Trace({ m }: { m: ChatMessage }) {
  const stage = m.stage ?? 0;
  const skipped = m.route === 'greeting' || m.route === 'handoff';
  return (
    <ol
      className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs"
      role="status"
      aria-label="Preparing the answer"
    >
      {TRACE_STEPS.map((label, i) => (
        <li
          key={label}
          className={`flex items-center gap-2 ${i <= stage ? 'text-gray-900' : 'text-gray-400'}`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
              i < stage
                ? 'border-brand-600 bg-brand-600 text-white'
                : i === stage
                  ? 'animate-pulse border-brand-600'
                  : 'border-gray-300'
            }`}
            aria-hidden
          >
            {i < stage ? '✓' : ''}
          </span>
          {label}
          {skipped && (i === 1 || i === 2) && <span className="text-gray-400">· skipped</span>}
          {i === 3 && m.tool && (
            <span className="text-gray-500">· {TOOL_LABELS[m.tool] ?? m.tool}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function SupportWidget() {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [chats, setChats] = useState<SupportConversation[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [opening, setOpening] = useState(false);
  const [needsPerson, setNeedsPerson] = useState(false);
  const [input, setInput] = useState('');
  const activeRef = useRef<string | null>(null);
  const sendRef = useRef<(text?: string) => void>(() => undefined);
  const seq = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const busy = messages.some((m) => m.role === 'assistant' && (m.stage ?? 4) < 4);
  const nextId = () => `l${++seq.current}`;

  // Signed in / out: chats belong to a different owner now.
  useEffect(() => {
    setChatsLoaded(false);
    newChat();
  }, [me?.id]);

  async function refreshChats() {
    try {
      setChats(await supportAssistantApi.conversations(visitorId()));
      setNotice('');
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setChatsLoaded(true);
    }
  }

  useEffect(() => {
    if (open && !chatsLoaded) void refreshChats();
  }, [open, chatsLoaded]);

  useEffect(() => {
    function onOpen(e: Event) {
      setOpen(true);
      setView('chat');
      const q = (e as CustomEvent<{ question?: string }>).detail?.question;
      if (q) setTimeout(() => sendRef.current(q), 0);
    }
    window.addEventListener(SUPPORT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open && view === 'chat') setTimeout(() => inputRef.current?.focus(), 250);
  }, [open, view]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, needsPerson]);

  function close() {
    setOpen(false);
    tabRef.current?.focus();
  }

  function patch(
    id: string,
    change: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>),
  ) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...(typeof change === 'function' ? change(m) : change) } : m,
      ),
    );
  }

  function newChat() {
    setView('chat');
    setActiveId(null);
    activeRef.current = null;
    setMessages([]);
    setNeedsPerson(false);
    setInput('');
  }

  async function openChat(id: string) {
    setView('chat');
    if (id === activeId) return;
    setActiveId(id);
    activeRef.current = id;
    setMessages([]);
    setNeedsPerson(false);
    setOpening(true);
    try {
      const rows = await supportAssistantApi.messages(visitorId(), id);
      if (activeRef.current === id) setMessages(rows.map(fromServer));
    } catch (err) {
      setMessages([
        { id: nextId(), role: 'assistant', stage: 4, error: true, content: errorText(err) },
      ]);
    } finally {
      setOpening(false);
    }
  }

  async function deleteChat(id: string) {
    try {
      await supportAssistantApi.deleteConversation(visitorId(), id);
      if (id === activeId) newChat();
      void refreshChats();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function giveFeedback(m: ChatMessage, value: Exclude<SupportFeedback, null>) {
    const next = m.fb === value ? null : value;
    patch(m.id, { fb: next });
    if (!m.serverId) return;
    try {
      await supportAssistantApi.feedback(visitorId(), m.serverId, next);
    } catch {
      /* keep the click on screen even if saving failed */
    }
  }

  async function send(text?: string) {
    const question = (text ?? input).trim().slice(0, SUPPORT_MESSAGE_MAX);
    if (!question || busy) return;
    const chatAtSend = activeRef.current;
    const botId = nextId();
    setInput('');
    setNeedsPerson(false);
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', content: question, at: new Date().toISOString() },
      { id: botId, role: 'assistant', stage: 0, content: '', sources: [], fb: null },
    ]);
    const stillHere = () => activeRef.current === chatAtSend;
    let failed: string | null = null;
    try {
      await supportAssistantApi.chat(
        visitorId(),
        { conversationId: chatAtSend, message: question },
        (e) => {
          if (!stillHere()) return; // switched chats; the answer is still saved
          switch (e.event) {
            case 'step':
              if (e.data.name === 'classify') patch(botId, { route: e.data.route });
              else if (e.data.name === 'retrieve')
                patch(botId, (m) => ({ stage: Math.max(m.stage ?? 0, 1) }));
              break;
            case 'meta':
              patch(botId, { stage: 3, route: e.data.route, sources: e.data.sources ?? [] });
              break;
            case 'tool':
              patch(botId, { tool: e.data.name });
              break;
            case 'handoff':
              setNeedsPerson(true);
              break;
            case 'delta':
              patch(botId, (m) => ({ content: m.content + e.data.text }));
              break;
            case 'done':
              setActiveId(e.data.conversation_id);
              activeRef.current = e.data.conversation_id;
              patch(botId, (m) => ({
                stage: 4,
                at: new Date().toISOString(),
                serverId: e.data.message_id,
                content:
                  m.content.trim() ||
                  "Sorry, I couldn't finish that answer. Please try asking again.",
              }));
              break;
            case 'error':
              failed = e.data.error;
              break;
          }
        },
      );
      if (failed) throw new Error(failed);
      void refreshChats();
    } catch (err) {
      patch(botId, {
        stage: 4,
        error: true,
        content: err instanceof ApiClientError ? errorText(err) : (failed ?? errorText(err)),
      });
    } finally {
      inputRef.current?.focus();
    }
  }
  sendRef.current = send;

  const markdown: Components = {
    a: ({ href = '', children }) => {
      const path = toPath(href);
      const cls =
        'inline-flex items-center gap-1 rounded-md border border-brand-600/30 bg-white px-2 py-0.5 font-medium text-brand-700 no-underline hover:bg-brand-50';
      return path ? (
        <Link href={path} className={cls}>
          {children} →
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {children} ↗
        </a>
      );
    },
  };

  function renderAssistant(m: ChatMessage, isLast: boolean) {
    if (m.error) {
      return (
        <div className="rounded-2xl rounded-bl-sm bg-red-50 px-3 py-2 text-sm text-red-700">
          {m.content}
        </div>
      );
    }
    const done = (m.stage ?? 4) >= 4;
    return (
      <div className="flex max-w-[90%] flex-col gap-1.5">
        {!done && !m.content && <Trace m={m} />}
        {m.content && (
          <div className="prose prose-sm max-w-none rounded-2xl rounded-bl-md border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 [&_a]:text-brand-700 [&_p]:my-1">
            <ReactMarkdown components={markdown}>{nameBareLinks(m.content)}</ReactMarkdown>
          </div>
        )}
        {done && isLast && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {(m.sources?.length ?? 0) > 0 && (
              <button
                type="button"
                className="mr-1 underline-offset-2 hover:underline"
                aria-expanded={m.expanded}
                onClick={() => patch(m.id, { expanded: !m.expanded })}
              >
                {m.sources!.length} source{m.sources!.length === 1 ? '' : 's'}
              </button>
            )}
            {(['up', 'down'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={m.fb === v}
                aria-label={v === 'up' ? 'Helpful' : 'Not helpful'}
                title={v === 'up' ? 'Helpful' : 'Not helpful'}
                onClick={() => void giveFeedback(m, v)}
                className={`rounded p-1 hover:bg-gray-100 ${m.fb === v ? 'text-brand-700' : ''}`}
              >
                {v === 'up' ? Icon.up : Icon.down}
              </button>
            ))}
            {m.at && <span className="ml-auto">{clock(m.at)}</span>}
          </div>
        )}
        {done && !isLast && m.at && <span className="text-xs text-gray-400">{clock(m.at)}</span>}
        {m.expanded && (
          <ul className="space-y-1 rounded-lg border border-gray-200 p-2 text-xs text-gray-600">
            {m.sources!.map((s, i) => (
              <li key={i} title={s.text} className="flex gap-2">
                {s.page != null && <span className="text-gray-400">p.{s.page}</span>}
                <span className="truncate">
                  {s.title || s.text.split('\n').find((l) => l.trim()) || 'Help article'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {done && isLast && m.fb === 'down' && (
          <p className="text-xs text-gray-500">
            Thanks, we&apos;ll review this answer.{' '}
            <button
              type="button"
              className="text-brand-700 hover:underline"
              onClick={() => setNeedsPerson(true)}
            >
              Talk to a person
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="support-panel"
        aria-label="Open support chat"
        className={`fixed bottom-[88px] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-gray-900 pl-4 pr-4 text-sm font-bold text-white shadow-[0_14px_30px_-12px_rgba(23,21,19,.6)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-600 md:bottom-6 md:right-6 md:pr-5 [html[data-sticky-cta]_&]:bottom-[96px] md:[html[data-sticky-cta]_&]:bottom-[96px] ${
          open ? 'pointer-events-none scale-75 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <span className="flex h-6 w-6 items-center justify-center [&_svg]:h-[22px] [&_svg]:w-[22px]">
          {Icon.chat}
        </span>
        <span className="hidden md:inline">Need help?</span>
      </button>

      <aside
        id="support-panel"
        aria-label="Customer support chat"
        aria-hidden={!open}
        className={`fixed inset-x-2 bottom-2 z-50 flex h-[min(78vh,640px)] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_60px_-20px_rgba(23,21,19,.45)] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] md:inset-x-auto md:bottom-6 md:right-6 md:h-[min(640px,calc(100vh-var(--header-h)-48px))] md:w-[390px] ${
          open
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0'
        }`}
      >
        <header className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3.5 text-white [&_button]:text-white/80 [&_button:hover]:bg-white/15 [&_button:hover]:text-white">
          {view === 'history' ? (
            <IconButton label="Back to chat" onClick={() => setView('chat')}>
              {Icon.back}
            </IconButton>
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-gray-900"
              aria-hidden
            >
              ?
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-white">
              {view === 'history' ? 'Your chats' : 'Customer support'}
            </h2>
            {view === 'chat' && (
              <p className="flex items-center gap-1.5 truncate text-xs text-brand-100">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-emerald-400" aria-hidden />
                {me ? `Signed in as ${me.email}` : 'Online assistant'}
              </p>
            )}
          </div>
          {view === 'chat' && (
            <IconButton
              label="Your chats"
              onClick={() => {
                setView('history');
                void refreshChats();
              }}
            >
              {Icon.history}
            </IconButton>
          )}
          <IconButton label="New chat" onClick={newChat} disabled={busy}>
            {Icon.plus}
          </IconButton>
          <IconButton label="Close support" onClick={close}>
            {Icon.close}
          </IconButton>
        </header>

        {view === 'history' ? (
          <div className="flex-1 overflow-y-auto p-3">
            {notice && <p className="p-3 text-sm text-gray-500">{notice}</p>}
            {!notice && chatsLoaded && chats.length === 0 && (
              <p className="p-3 text-sm text-gray-500">
                No chats yet. Your conversations will appear here.
              </p>
            )}
            <ul className="space-y-1">
              {chats.map((c) => (
                <li
                  key={c.id}
                  className={`group flex items-center rounded-lg ${c.id === activeId ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-3 py-2 text-left"
                    onClick={() => void openChat(c.id)}
                  >
                    <span className="block truncate text-sm text-gray-900">{c.title}</span>
                    <span className="text-xs text-gray-500">{timeAgo(c.updatedAt)}</span>
                  </button>
                  <IconButton
                    label={`Delete chat: ${c.title}`}
                    onClick={() => void deleteChat(c.id)}
                    disabled={busy && c.id === activeId}
                  >
                    {Icon.close}
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div
              ref={threadRef}
              className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-gray-50/60 p-4"
              aria-live="polite"
            >
              {opening ? (
                <p className="text-sm text-gray-500">Loading chat…</p>
              ) : messages.length === 0 ? (
                <div className="pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    New conversation
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900">Hi! How can we help?</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Ask about your orders, delivery, payments, returns or products.
                    {!me && ' Sign in to let the assistant look up your orders.'}
                  </p>
                  <div className="mt-4 flex flex-col items-start gap-2">
                    {SUPPORT_SUGGESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void send(q)}
                        className="rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-left text-sm font-medium text-gray-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {m.role === 'user' && (
                      <>
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white">
                          {m.content}
                        </div>
                        {m.at && <span className="mt-1 text-xs text-gray-400">{clock(m.at)}</span>}
                      </>
                    )}
                    {m.role === 'assistant' && renderAssistant(m, i === messages.length - 1)}
                    {m.role === 'agent' && (
                      <div className="max-w-[85%]">
                        <span className="text-xs text-gray-500">{m.author || 'Support'}</span>
                        <div className="rounded-2xl rounded-bl-sm bg-brand-50 px-3 py-2 text-sm text-gray-900">
                          {m.content}
                        </div>
                      </div>
                    )}
                    {m.role === 'system' && (
                      <p className="w-full text-center text-xs text-gray-500">{m.content}</p>
                    )}
                  </div>
                ))
              )}
              {needsPerson && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Our support team can help with this.{' '}
                  <Link
                    href="/contact"
                    className="font-medium text-brand-700 hover:underline"
                    onClick={close}
                  >
                    Contact us
                  </Link>{' '}
                  and include your order number if you have one.
                </div>
              )}
            </div>
            <form
              className="flex items-center gap-2 border-t border-gray-100 bg-white p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                ref={inputRef}
                value={input}
                maxLength={SUPPORT_MESSAGE_MAX}
                onChange={(e) => setInput(e.target.value)}
                placeholder={busy ? 'Waiting for the answer…' : 'Type your question'}
                aria-label="Your question"
                className="h-11 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm focus:border-brand-500 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {Icon.send}
              </button>
            </form>
            <div className="flex justify-between bg-white px-4 pb-3 text-xs text-gray-500">
              <span>AI assistant: answers can be wrong.</span>
              <button
                type="button"
                className="text-brand-700 hover:underline"
                onClick={() => setNeedsPerson(true)}
              >
                Talk to a person
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
