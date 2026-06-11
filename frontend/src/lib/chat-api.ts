import { apiRequest } from './api';
import type { ChatMessage, ChatThread } from './types';

export function listThreads() {
  return apiRequest<ChatThread[]>('/chat/threads');
}

export function createThread(title?: string) {
  return apiRequest<ChatThread>('/chat/threads', { method: 'POST', body: { title } });
}

export function listMessages(threadId: number) {
  return apiRequest<ChatMessage[]>(`/chat/threads/${threadId}/messages`);
}

export function deleteThread(threadId: number) {
  return apiRequest<{ message: string }>(`/chat/threads/${threadId}`, { method: 'DELETE' });
}
