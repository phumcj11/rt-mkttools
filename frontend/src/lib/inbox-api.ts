import { apiRequest } from './api';

export interface ChannelConfig {
  id: number;
  channel: 'line' | 'facebook' | 'whatsapp' | 'webchat';
  pageId: string;
  pageName: string;
  isActive: boolean;
  createdAt: string;
}

export interface Conversation {
  id: number;
  channel: string;
  externalId: string;
  customerName: string | null;
  customerHandle: string | null;
  status: 'open' | 'resolved' | 'pending';
  assignedUserId: number | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface InboxMessage {
  id: number;
  conversationId: number;
  direction: 'in' | 'out';
  content: string;
  mediaUrl: string | null;
  sentAt: string;
}

export interface UpsertChannelDto {
  channel: 'line' | 'facebook' | 'whatsapp' | 'webchat';
  pageId: string;
  pageName?: string;
  credentials: Record<string, string>;
  isActive?: boolean;
}

// ─── Channels ──────────────────────────────────────────────────────────────

export function listChannels() {
  return apiRequest<ChannelConfig[]>('/inbox/channels');
}

export function upsertChannel(dto: UpsertChannelDto) {
  return apiRequest<ChannelConfig>('/inbox/channels', { method: 'POST', body: dto });
}

export function deleteChannel(id: number) {
  return apiRequest<{ message: string }>(`/inbox/channels/${id}`, { method: 'DELETE' });
}

// ─── Conversations ──────────────────────────────────────────────────────────

export function listConversations(status?: string) {
  const q = status ? `?status=${status}` : '';
  return apiRequest<Conversation[]>(`/inbox/conversations${q}`);
}

export function listInboxMessages(conversationId: number) {
  return apiRequest<InboxMessage[]>(`/inbox/conversations/${conversationId}/messages`);
}

export function sendReply(conversationId: number, content: string) {
  return apiRequest<InboxMessage>(`/inbox/conversations/${conversationId}/reply`, {
    method: 'POST',
    body: { content },
  });
}

export function markRead(conversationId: number) {
  return apiRequest<Conversation>(`/inbox/conversations/${conversationId}/read`, { method: 'POST' });
}

export function resolveConversation(conversationId: number) {
  return apiRequest<Conversation>(`/inbox/conversations/${conversationId}/resolve`, { method: 'POST' });
}
