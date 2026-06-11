import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ChatService } from '../chat/chat.service';
import { RealtimeService } from './realtime.service';
import { tenantRoom, userRoom, verifySocketUser } from './ws-auth';

const corsOrigins = (process.env.SOCKET_CORS_ORIGINS ?? process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

interface ChatSendPayload {
  threadId?: number;
  message?: string;
  locale?: string;
}

@WebSocketGateway({
  cors: { origin: corsOrigins, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly accessSecret: string;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
    private readonly chat: ChatService,
  ) {
    this.accessSecret = this.config.getOrThrow<string>('jwt.accessSecret');
  }

  afterInit(server: Server) {
    this.realtime.setServer(server);
    this.logger.log('Socket.io gateway พร้อมใช้งาน');
  }

  handleConnection(client: Socket) {
    const user = verifySocketUser(client, this.jwt, this.accessSecret);
    if (!user) {
      client.emit('auth:error', { code: 'auth.unauthorized' });
      client.disconnect(true);
      return;
    }
    client.data.user = user;
    client.join(userRoom(user.id));
    client.join(tenantRoom(user.tenantId));
    client.emit('connected', { userId: user.id, tenantId: user.tenantId });
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(client: Socket, payload: ChatSendPayload) {
    const user: AuthUser | undefined = client.data.user;
    if (!user) {
      client.emit('chat:error', { code: 'auth.unauthorized' });
      return;
    }

    const message = (payload?.message ?? '').trim();
    if (!message) {
      client.emit('chat:error', { code: 'chat.emptyMessage' });
      return;
    }

    const threadId = typeof payload.threadId === 'number' ? payload.threadId : undefined;

    try {
      client.emit('chat:start', { threadId: threadId ?? null });

      const result = await this.chat.streamReply(
        {
          tenantId: user.tenantId,
          userId: user.id,
          threadId,
          message,
          locale: payload.locale ?? user.locale,
        },
        (delta) => client.emit('chat:chunk', { delta }),
      );

      client.emit('chat:done', result);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? 'chat.replyFailed';
      client.emit('chat:error', { code });
    }
  }
}
