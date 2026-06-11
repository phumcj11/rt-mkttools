import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

function socketBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:4000';
}

let socket: Socket | null = null;

/**
 * คืน socket instance เดียวร่วมกันทั้งแอป (lazy connect ด้วย access token ปัจจุบัน)
 * ฝั่ง backend รับ token ผ่าน handshake `auth.token`
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(socketBaseUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? '' }),
  });

  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    // อัปเดต token ล่าสุดก่อนเชื่อมต่อทุกครั้ง
    s.auth = { token: useAuthStore.getState().accessToken ?? '' };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
