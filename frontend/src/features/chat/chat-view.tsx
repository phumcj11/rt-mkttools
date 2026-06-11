'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  deleteThread as apiDeleteThread,
  listMessages,
  listThreads,
} from '@/lib/chat-api';
import { connectSocket, getSocket } from '@/lib/socket';
import type { ChatDonePayload, ChatMessage, ChatThread } from '@/lib/types';

export function ChatView() {
  const t = useTranslations('chat');
  const locale = useLocale();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  useEffect(() => {
    listThreads()
      .then(setThreads)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  // ฟัง event การสตรีมคำตอบจาก socket
  useEffect(() => {
    const socket = connectSocket();

    const onChunk = ({ delta }: { delta: string }) =>
      setStreaming((prev) => (prev ?? '') + delta);

    const onDone = (payload: ChatDonePayload) => {
      setStreaming(null);
      setSending(false);
      setActiveId(payload.threadId);
      setMessages((prev) => [
        ...prev,
        {
          id: payload.assistantMessageId,
          threadId: payload.threadId,
          role: 'assistant',
          content: payload.content,
          createdAt: new Date().toISOString(),
        },
      ]);
      // refresh รายการบทสนทนา (กรณีเพิ่งสร้าง thread ใหม่)
      listThreads()
        .then(setThreads)
        .catch(() => undefined);
    };

    const onError = ({ code }: { code: string }) => {
      setStreaming(null);
      setSending(false);
      setError(code === 'ai.notConfigured' ? t('aiNotConfigured') : t('replyError'));
    };

    socket.on('chat:chunk', onChunk);
    socket.on('chat:done', onDone);
    socket.on('chat:error', onError);

    return () => {
      socket.off('chat:chunk', onChunk);
      socket.off('chat:done', onDone);
      socket.off('chat:error', onError);
    };
  }, [t]);

  async function selectThread(id: number) {
    setActiveId(id);
    setError(null);
    setStreaming(null);
    try {
      const msgs = await listMessages(id);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setStreaming(null);
    setError(null);
  }

  async function removeThread(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await apiDeleteThread(id);
    } catch {
      // เงียบไว้
    }
    setThreads((prev) => prev.filter((th) => th.id !== id));
    if (activeIdRef.current === id) newChat();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setError(null);
    setSending(true);
    setStreaming('');
    setInput('');
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        threadId: activeId ?? 0,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      },
    ]);

    const socket = getSocket();
    socket.emit('chat:send', {
      threadId: activeId ?? undefined,
      message,
      locale,
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mb-4 text-muted-foreground">{t('subtitle')}</p>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Thread list */}
        <div className="flex flex-col rounded-lg border bg-card">
          <div className="border-b p-3">
            <Button onClick={newChat} className="w-full" variant="outline">
              <Plus className="h-4 w-4" />
              {t('newChat')}
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {threads.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t('noThreads')}
              </p>
            ) : (
              threads.map((th) => (
                <button
                  key={th.id}
                  onClick={() => selectThread(th.id)}
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    activeId === th.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{th.title ?? t('untitled')}</span>
                  <Trash2
                    className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={(e) => removeThread(th.id, e)}
                  />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex h-[70vh] flex-col rounded-lg border bg-card">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !streaming ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <MessageCircle className="mb-3 h-10 w-10 text-gold" />
                <p className="text-sm">{t('emptyHint')}</p>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <ChatBubble key={m.id} role={m.role} content={m.content} />
                ))}
                {streaming !== null && (
                  <ChatBubble role="assistant" content={streaming || '…'} />
                )}
              </>
            )}
          </div>

          {error && (
            <div className="mx-4 mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
            <Textarea
              className="max-h-32 min-h-[44px] flex-1 resize-none"
              placeholder={t('inputPlaceholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        {content}
      </div>
    </div>
  );
}
