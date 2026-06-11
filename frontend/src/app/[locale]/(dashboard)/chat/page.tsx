import { setRequestLocale } from 'next-intl/server';
import { ChatView } from '@/features/chat/chat-view';

export default function ChatPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ChatView />;
}
