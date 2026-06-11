import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AuthUser, JwtPayload } from '../../common/interfaces/auth-user.interface';

/**
 * ดึง access token จาก handshake ของ socket
 * รองรับทั้ง `auth.token` (แนะนำ) และ header `Authorization: Bearer ...`
 */
export function extractSocketToken(client: Socket): string | null {
  const authToken = (client.handshake.auth as { token?: string } | undefined)?.token;
  if (authToken) return authToken.replace(/^Bearer\s+/i, '');

  const header = client.handshake.headers?.authorization;
  if (header) return header.replace(/^Bearer\s+/i, '');

  const queryToken = client.handshake.query?.token;
  if (typeof queryToken === 'string') return queryToken;

  return null;
}

export function verifySocketUser(
  client: Socket,
  jwt: JwtService,
  secret: string,
): AuthUser | null {
  const token = extractSocketToken(client);
  if (!token) return null;

  try {
    const payload = jwt.verify<JwtPayload>(token, { secret });
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles ?? [],
      locale: payload.locale ?? 'th',
    };
  } catch {
    return null;
  }
}

export const userRoom = (userId: number) => `user:${userId}`;
export const tenantRoom = (tenantId: number) => `tenant:${tenantId}`;
