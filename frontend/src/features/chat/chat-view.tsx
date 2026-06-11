'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Loader2, MessageCircle, Plus, Send, Trash2,
  Inbox, Users, Share2, Bot,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  deleteThread as apiDeleteThread,
  listMessages,
  listThreads,
} from '@/lib/chat-api';
import { connectSocket, getSocket } from '@/lib/socket';
import type { ChatDonePayload, ChatMessage, ChatThread } from '@/lib/types';

type Tab = 'ai' | 'inbox' | 'customers' | 'channels';

const TABS: { id: Tab; label: string; icon: typeof Bot; badge?: string }[] = [
  { id: 'ai',        label: 'AI Chat',         icon: Bot             },
  { id: 'inbox',     label: 'Shared Inbox',    icon: Inbox,  badge: '3' },
  { id: 'customers', label: 'Customer Profile', icon: Users           },
  { id: 'channels',  label: 'Channels',        icon: Share2          },
];

export function ChatView() {
  const t = useTranslations('chat');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<Tab>('ai');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Omnichannel Chat</h1>
        <p className="text-muted-foreground">
          AI Chat ผู้ช่วย + Shared Inbox + Customer Profile + Channel Connectors
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.badge && (
                <Badge variant="destructive" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {tab.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'ai' && <AiChatPanel t={t} locale={locale} />}
      {activeTab === 'inbox' && <SharedInboxPanel />}
      {activeTab === 'customers' && <CustomerProfilePanel />}
      {activeTab === 'channels' && <ChannelsPanel />}
    </div>
  );
}

function AiChatPanel({ t, locale }: { t: ReturnType<typeof useTranslations>; locale: string }) {
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
    listThreads().then(setThreads).catch(() => undefined);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

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
        { id: payload.assistantMessageId, threadId: payload.threadId, role: 'assistant', content: payload.content, createdAt: new Date().toISOString() },
      ]);
      listThreads().then(setThreads).catch(() => undefined);
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
    const msgs = await listMessages(id).catch(() => []);
    setMessages(msgs);
  }

  function newChat() { setActiveId(null); setMessages([]); setStreaming(null); setError(null); }

  async function removeThread(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await apiDeleteThread(id).catch(() => undefined);
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
    setMessages((prev) => [...prev, { id: Date.now(), threadId: activeId ?? 0, role: 'user', content: message, createdAt: new Date().toISOString() }]);
    getSocket().emit('chat:send', { threadId: activeId ?? undefined, message, locale });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="flex flex-col rounded-lg border bg-card">
        <div className="border-b p-3">
          <Button onClick={newChat} className="w-full" variant="outline">
            <Plus className="mr-2 h-4 w-4" />{t('newChat')}
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {threads.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t('noThreads')}</p>
          ) : (
            threads.map((th) => (
              <button
                key={th.id}
                onClick={() => void selectThread(th.id)}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                  activeId === th.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{th.title ?? t('untitled')}</span>
                <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" onClick={(e) => void removeThread(th.id, e)} />
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex h-[70vh] flex-col rounded-lg border bg-card">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && !streaming ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <MessageCircle className="mb-3 h-10 w-10 text-gold" />
              <p className="text-sm">{t('emptyHint')}</p>
            </div>
          ) : (
            <>
              {messages.map((m) => <ChatBubble key={m.id} role={m.role} content={m.content} />)}
              {streaming !== null && <ChatBubble role="assistant" content={streaming || '…'} />}
            </>
          )}
        </div>
        {error && (
          <div className="mx-4 mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
          <Textarea
            className="max-h-32 min-h-[44px] flex-1 resize-none"
            placeholder={t('inputPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ChatBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm', isUser ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground')}>
        {content}
      </div>
    </div>
  );
}

const MOCK_TICKETS = [
  { id: 1, customer: 'สมชาย ใจดี',   channel: 'LINE',      msg: 'สอบถามสินค้าหมดเมื่อไหร่',  time: '5 นาที', status: 'open'    },
  { id: 2, customer: 'วารี สวยงาม',  channel: 'Facebook',  msg: 'ต้องการใบเสร็จ',             time: '15 นาที', status: 'open'   },
  { id: 3, customer: 'ประสิทธิ์ เก่ง', channel: 'LINE',   msg: 'ขอบคุณมากค่ะ',               time: '1 ชม.',   status: 'closed' },
];

function SharedInboxPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium">Shared Inbox (Scaffold)</p>
        <Badge variant="secondary">3 รอดำเนินการ</Badge>
      </div>
      {MOCK_TICKETS.map((t) => (
        <Card key={t.id} className={t.status === 'closed' ? 'opacity-60' : ''}>
          <CardContent className="flex items-center gap-3 pt-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
              {t.customer.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{t.customer}</span>
                <Badge variant="outline" className="text-[10px]">{t.channel}</Badge>
                {t.status === 'open' && <Badge variant="destructive" className="text-[10px]">รอตอบ</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{t.msg}</p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{t.time}</span>
          </CardContent>
        </Card>
      ))}
      <Card className="border-dashed">
        <CardContent className="pt-3 text-center text-sm text-muted-foreground py-6">
          เชื่อมต่อ LINE OA, Facebook Messenger, Instagram DM เพื่อรับ messages ใน Shared Inbox
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerProfilePanel() {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-2">
        <Users className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="font-medium">Customer Profile</p>
        <p className="text-sm text-muted-foreground">
          ประวัติลูกค้า, การซื้อ, Tickets, Sentiment — พัฒนาต่อเนื่อง
        </p>
        <Badge variant="outline">เร็ว ๆ นี้</Badge>
      </CardContent>
    </Card>
  );
}

function ChannelsPanel() {
  const channels = [
    { name: 'LINE Official Account', status: 'ready',     desc: 'เชื่อมต่อผ่าน LINE Messaging API' },
    { name: 'Facebook Messenger',    status: 'coming',    desc: 'Facebook Graph API' },
    { name: 'Instagram DM',          status: 'coming',    desc: 'Instagram Messaging API' },
    { name: 'Website Live Chat',     status: 'coming',    desc: 'Widget embed บนเว็บไซต์' },
  ];
  return (
    <div className="space-y-3">
      {channels.map((ch) => (
        <Card key={ch.name}>
          <CardContent className="flex items-center gap-4 pt-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{ch.name}</p>
              <p className="text-xs text-muted-foreground">{ch.desc}</p>
            </div>
            {ch.status === 'ready' ? (
              <Button size="sm">เชื่อมต่อ</Button>
            ) : (
              <Badge variant="outline" className="text-xs">เร็ว ๆ นี้</Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
