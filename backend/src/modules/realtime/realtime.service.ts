import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { tenantRoom, userRoom } from './ws-auth';

/**
 * จุดกลางสำหรับ emit event ไปยัง client ผ่าน Socket.io
 * gateway จะ inject server เข้ามาตอน init เพื่อเลี่ยง circular dependency
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: number, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  emitToTenant(tenantId: number, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(tenantRoom(tenantId)).emit(event, payload);
  }
}
