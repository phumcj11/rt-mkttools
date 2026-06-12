'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Loader2, MessageCircle, Plus, Send, Trash2,
  Inbox, Users, Share2, Bot, CheckCircle2,
  RefreshCw, ChevronLeft, Settings, Copy, Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  deleteThread as apiDeleteThread,
  listMessages,
  listThreads,
} from '@/lib/chat-api';
import { connectSocket, getSocket } from '@/lib/socket';
import type { ChatDonePayload, ChatMessage, ChatThread } from '@/lib/types';
import {
  listConversations, listInboxMessages, sendReply, markRead, resolveConversation,
  listChannels, upsertChannel, deleteChannel,
} from '@/lib/inbox-api';
import type { Conversation, InboxMessage, ChannelConfig } from '@/lib/inbox-api';

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

const CHANNEL_COLORS: Record<string, string> = {
  line:     'bg-green-500/10 text-green-700',
  facebook: 'bg-blue-500/10 text-blue-700',
  whatsapp: 'bg-emerald-500/10 text-emerald-700',
  webchat:  'bg-purple-500/10 text-purple-700',
};

function SharedInboxPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listConversations().catch(() => []);
    setConversations(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Real-time: listen inbox:new to update unread badge
  useEffect(() => {
    const socket = connectSocket();
    const onNew = (payload: { conversationId: number; content: string; unreadCount: number }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === payload.conversationId
            ? { ...c, unreadCount: payload.unreadCount }
            : c,
        ),
      );
      if (active?.id === payload.conversationId) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), conversationId: payload.conversationId, direction: 'in', content: payload.content, mediaUrl: null, sentAt: new Date().toISOString() },
        ]);
      }
    };
    socket.on('inbox:new', onNew);
    return () => { socket.off('inbox:new', onNew); };
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (conv: Conversation) => {
    setActive(conv);
    const msgs = await listInboxMessages(conv.id).catch(() => []);
    setMessages(msgs);
    if (conv.unreadCount > 0) {
      await markRead(conv.id).catch(() => null);
      setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
    }
  };

  const handleSend = async () => {
    if (!active || !replyText.trim()) return;
    setSending(true);
    try {
      const msg = await sendReply(active.id, replyText.trim());
      setMessages((prev) => [...prev, msg]);
      setReplyText('');
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleResolve = async () => {
    if (!active) return;
    await resolveConversation(active.id).catch(() => null);
    setConversations((prev) => prev.map((c) => c.id === active.id ? { ...c, status: 'resolved' } : c));
    setActive(null);
  };

  const openCount = conversations.filter((c) => c.status === 'open').length;

  if (active) {
    return (
      <div className="flex flex-col h-[70vh] rounded-lg border bg-card">
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActive(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{active.customerName ?? active.externalId}</p>
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', CHANNEL_COLORS[active.channel] ?? 'bg-muted')}>
              {active.channel.toUpperCase()}
            </span>
          </div>
          {active.status !== 'resolved' && (
            <Button size="sm" variant="outline" onClick={() => void handleResolve()}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Resolve
            </Button>
          )}
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm', m.direction === 'out' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted')}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
        {active.status !== 'resolved' && (
          <div className="flex items-end gap-2 border-t p-3">
            <Textarea
              className="max-h-28 min-h-[40px] flex-1 resize-none"
              placeholder="พิมพ์ข้อความตอบกลับ..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
            />
            <Button size="icon" disabled={sending || !replyText.trim()} onClick={() => void handleSend()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-medium">Shared Inbox</p>
          {openCount > 0 && <Badge variant="destructive">{openCount} รอตอบ</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />รีเฟรช
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด...
        </div>
      ) : conversations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ยังไม่มีบทสนทนา — เชื่อมต่อ LINE OA หรือ Facebook Page เพื่อรับ messages
          </CardContent>
        </Card>
      ) : (
        conversations.map((conv) => (
          <button key={conv.id} onClick={() => void openConversation(conv)} className="w-full text-left">
            <Card className={cn(conv.unreadCount > 0 && 'border-primary/40 bg-primary/5')}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
                  {(conv.customerName ?? conv.externalId).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{conv.customerName ?? conv.externalId}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', CHANNEL_COLORS[conv.channel] ?? 'bg-muted')}>
                      {conv.channel.toUpperCase()}
                    </span>
                    {conv.status === 'resolved' && <Badge variant="secondary" className="text-[10px]">Resolved</Badge>}
                    {conv.unreadCount > 0 && <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">{conv.unreadCount}</Badge>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </CardContent>
            </Card>
          </button>
        ))
      )}
    </div>
  );
}

function CustomerProfilePanel() {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-2">
        <Users className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="font-medium">Customer Profile</p>
        <p className="text-sm text-muted-foreground">ประวัติลูกค้า, การซื้อ, Tickets, Sentiment</p>
        <Badge variant="outline">เร็ว ๆ นี้</Badge>
      </CardContent>
    </Card>
  );
}

type ChannelFormType = 'line' | 'facebook' | null;

const CHANNEL_DEFS = [
  { id: 'line' as const,     name: 'LINE Official Account', desc: 'LINE Messaging API',  webhookPath: '/api/chat/line-webhook' },
  { id: 'facebook' as const, name: 'Facebook Messenger',    desc: 'Facebook Graph API',  webhookPath: '/api/chat/fb-webhook'  },
  { id: 'whatsapp' as const, name: 'WhatsApp Business',     desc: 'Meta Cloud API',      webhookPath: '' },
  { id: 'webchat' as const,  name: 'Web Chat Widget',       desc: 'Widget embed บนเว็บ', webhookPath: '' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ml-1 inline-flex items-center gap-1 rounded px-1 text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ChannelsPanel() {
  const [configs, setConfigs] = useState<ChannelConfig[]>([]);
  const [showForm, setShowForm] = useState<ChannelFormType>(null);
  const [saving, setSaving] = useState(false);

  // LINE form state
  const [lineChannelId, setLineChannelId] = useState('');
  const [linePageName, setLinePageName] = useState('');
  const [lineSecret, setLineSecret] = useState('');
  const [lineToken, setLineToken] = useState('');

  // Facebook form state
  const [fbPageId, setFbPageId] = useState('');
  const [fbPageName, setFbPageName] = useState('');
  const [fbPageToken, setFbPageToken] = useState('');
  const [fbAppSecret, setFbAppSecret] = useState('');
  const [fbVerifyToken, setFbVerifyToken] = useState('mkttools_fb_verify');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rt.k-mkt.com';

  const load = useCallback(async () => {
    const data = await listChannels().catch(() => []);
    setConfigs(data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveLineChannel = async () => {
    if (!lineChannelId || !lineSecret || !lineToken) return;
    setSaving(true);
    try {
      await upsertChannel({ channel: 'line', pageId: lineChannelId, pageName: linePageName || lineChannelId, credentials: { channelSecret: lineSecret, channelAccessToken: lineToken } });
      await load();
      setShowForm(null);
      setLineChannelId(''); setLinePageName(''); setLineSecret(''); setLineToken('');
    } catch { /* ignore */ }
    setSaving(false);
  };

  const saveFbChannel = async () => {
    if (!fbPageId || !fbPageToken || !fbAppSecret) return;
    setSaving(true);
    try {
      await upsertChannel({ channel: 'facebook', pageId: fbPageId, pageName: fbPageName || fbPageId, credentials: { pageAccessToken: fbPageToken, appSecret: fbAppSecret, verifyToken: fbVerifyToken } });
      await load();
      setShowForm(null);
      setFbPageId(''); setFbPageName(''); setFbPageToken(''); setFbAppSecret('');
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    await deleteChannel(id).catch(() => null);
    await load();
  };

  return (
    <div className="space-y-4">
      {/* Configured channels */}
      {configs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Channels ที่เชื่อมต่อแล้ว</p>
          {configs.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', CHANNEL_COLORS[c.channel] ?? 'bg-muted')}>
                  {c.channel.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.pageName || c.pageId}</p>
                  <p className="text-xs text-muted-foreground">{c.pageId}</p>
                </div>
                <Badge variant={c.isActive ? 'default' : 'secondary'} className="text-xs">
                  {c.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleDelete(c.id)}>
                  ลบ
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add channel buttons */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">เพิ่ม Channel ใหม่</p>
        {CHANNEL_DEFS.map((ch) => {
          const alreadyAdded = configs.some((c) => c.channel === ch.id);
          const isComingSoon = ch.id === 'whatsapp' || ch.id === 'webchat';
          return (
            <Card key={ch.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex-1">
                  <p className="font-medium text-sm">{ch.name}</p>
                  <p className="text-xs text-muted-foreground">{ch.desc}</p>
                </div>
                {isComingSoon ? (
                  <Badge variant="outline" className="text-xs">เร็ว ๆ นี้</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={showForm === ch.id ? 'secondary' : 'default'}
                    onClick={() => setShowForm(showForm === ch.id ? null : ch.id as ChannelFormType)}
                  >
                    <Settings className="mr-1.5 h-3.5 w-3.5" />
                    {alreadyAdded ? 'เพิ่มอีก' : 'เชื่อมต่อ'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* LINE setup form */}
      {showForm === 'line' && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">เชื่อมต่อ LINE Official Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-md bg-muted p-3 space-y-1">
              <p className="text-xs font-semibold">Webhook URL (ตั้งใน LINE Developers Console)</p>
              <div className="flex items-center gap-1 font-mono text-xs break-all">
                {baseUrl}/api/chat/line-webhook
                <CopyButton text={`${baseUrl}/api/chat/line-webhook`} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Channel ID *</Label>
                <Input placeholder="1234567890" value={lineChannelId} onChange={(e) => setLineChannelId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ชื่อ Channel</Label>
                <Input placeholder="100 Baht Shop LINE" value={linePageName} onChange={(e) => setLinePageName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Channel Secret *</Label>
              <Input type="password" placeholder="Channel Secret จาก LINE Console" value={lineSecret} onChange={(e) => setLineSecret(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Channel Access Token *</Label>
              <Input type="password" placeholder="Long-lived access token" value={lineToken} onChange={(e) => setLineToken(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={saving || !lineChannelId || !lineSecret || !lineToken} onClick={() => void saveLineChannel()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'บันทึก'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(null)}>ยกเลิก</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Facebook setup form */}
      {showForm === 'facebook' && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">เชื่อมต่อ Facebook Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-md bg-muted p-3 space-y-1">
              <p className="text-xs font-semibold">Callback URL (ตั้งใน Facebook Developers)</p>
              <div className="flex items-center gap-1 font-mono text-xs break-all">
                {baseUrl}/api/chat/fb-webhook
                <CopyButton text={`${baseUrl}/api/chat/fb-webhook`} />
              </div>
              <p className="text-xs font-semibold mt-2">Verify Token</p>
              <div className="flex items-center gap-1 font-mono text-xs">
                {fbVerifyToken}
                <CopyButton text={fbVerifyToken} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Page ID *</Label>
                <Input placeholder="1234567890123456" value={fbPageId} onChange={(e) => setFbPageId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ชื่อ Page</Label>
                <Input placeholder="100 Baht Shop Thailand" value={fbPageName} onChange={(e) => setFbPageName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Page Access Token *</Label>
              <Input type="password" placeholder="Page Access Token" value={fbPageToken} onChange={(e) => setFbPageToken(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>App Secret *</Label>
              <Input type="password" placeholder="App Secret จาก Facebook App" value={fbAppSecret} onChange={(e) => setFbAppSecret(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={saving || !fbPageId || !fbPageToken || !fbAppSecret} onClick={() => void saveFbChannel()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'บันทึก'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(null)}>ยกเลิก</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
