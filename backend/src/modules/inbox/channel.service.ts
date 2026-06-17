import { Injectable, Logger } from '@nestjs/common';
import { messagingApi } from '@line/bot-sdk';
import type { ChannelConfig, FacebookCredentials, LineCredentials } from '../../database/entities';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  // ─── LINE ─────────────────────────────────────────────────────────────

  async replyLine(config: ChannelConfig, replyToken: string, text: string): Promise<void> {
    const creds = config.credentials as LineCredentials;
    if (!creds.channelAccessToken || !replyToken) return;
    try {
      const client = new messagingApi.MessagingApiClient({
        channelAccessToken: creds.channelAccessToken,
      });
      await client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text }],
      });
    } catch (err) {
      this.logger.error(`LINE reply failed: ${String(err)}`);
    }
  }

  async pushLine(config: ChannelConfig, to: string, text: string): Promise<void> {
    const creds = config.credentials as LineCredentials;
    if (!creds.channelAccessToken) return;
    try {
      const client = new messagingApi.MessagingApiClient({
        channelAccessToken: creds.channelAccessToken,
      });
      await client.pushMessage({ to, messages: [{ type: 'text', text }] });
    } catch (err) {
      this.logger.error(`LINE push failed: ${String(err)}`);
      throw err;
    }
  }

  /** Broadcast to all LINE friends (requires Messaging API broadcast permission). */
  async broadcastLine(
    config: ChannelConfig,
    text: string,
  ): Promise<{ ok: boolean; message: string }> {
    const creds = config.credentials as LineCredentials;
    if (!creds.channelAccessToken) {
      return { ok: false, message: 'ไม่มี LINE channel access token' };
    }
    try {
      const client = new messagingApi.MessagingApiClient({
        channelAccessToken: creds.channelAccessToken,
      });
      await client.broadcast({
        messages: [{ type: 'text', text: text.slice(0, 5000) }],
      });
      return { ok: true, message: 'ส่ง LINE Broadcast สำเร็จ' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LINE broadcast failed: ${msg}`);
      return {
        ok: false,
        message: `LINE Broadcast ไม่สำเร็จ (${msg}) — ใช้ LINE OA Manager ส่ง manual แทน`,
      };
    }
  }

  // ─── Facebook ─────────────────────────────────────────────────────────

  async replyFacebook(config: ChannelConfig, psid: string, text: string): Promise<void> {
    const creds = config.credentials as FacebookCredentials;
    if (!creds.pageAccessToken) return;
    try {
      const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${creds.pageAccessToken}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: psid },
          message: { text },
          messaging_type: 'RESPONSE',
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`FB reply HTTP ${res.status}: ${body}`);
      }
    } catch (err) {
      this.logger.error(`Facebook reply failed: ${String(err)}`);
    }
  }
}
