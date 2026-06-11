import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { ChatMessage, ChatThread } from '../../database/entities';
import { AiService } from '../ai/ai.service';
import { ChatMessageInput, OpenAiService } from '../ai/openai.service';

const MAX_CONTEXT_MESSAGES = 20;

const SYSTEM_PROMPT: Record<string, string> = {
  th: [
    'คุณคือผู้ช่วย AI ด้านการตลาดสำหรับร้าน 100 บาทในประเทศไทย',
    'ตอบเป็นภาษาไทยที่เป็นกันเอง กระชับ และนำไปใช้ได้จริง',
    'เชี่ยวชาญเรื่องคอนเทนต์โซเชียล โปรโมชั่น แคมเปญ และการเพิ่มยอดขายสำหรับร้านค้าขนาดเล็ก',
  ].join(' '),
  en: [
    'You are a marketing AI assistant for a 100-baht shop in Thailand.',
    'Reply concisely with practical, actionable advice.',
    'You specialize in social content, promotions, campaigns, and boosting sales for small retailers.',
  ].join(' '),
};

export interface StreamReplyParams {
  tenantId: number;
  userId: number;
  threadId?: number;
  message: string;
  locale?: string;
}

export interface StreamReplyResult {
  threadId: number;
  userMessageId: number;
  assistantMessageId: number;
  content: string;
  tokens: { prompt: number; completion: number; total: number };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatThread) private readonly threadRepo: Repository<ChatThread>,
    @InjectRepository(ChatMessage) private readonly messageRepo: Repository<ChatMessage>,
    private readonly ai: AiService,
    private readonly openai: OpenAiService,
  ) {}

  listThreads(tenantId: number, userId: number) {
    return this.threadRepo.find({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async createThread(tenantId: number, userId: number, title?: string | null) {
    const thread = this.threadRepo.create({
      tenantId,
      userId,
      title: title?.slice(0, 200) ?? null,
    });
    return this.threadRepo.save(thread);
  }

  async getThreadOrThrow(tenantId: number, userId: number, threadId: number) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId, tenantId, userId } });
    if (!thread) {
      throw new AppException('chat.threadNotFound', HttpStatus.NOT_FOUND);
    }
    return thread;
  }

  async listMessages(tenantId: number, userId: number, threadId: number) {
    await this.getThreadOrThrow(tenantId, userId, threadId);
    return this.messageRepo.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async deleteThread(tenantId: number, userId: number, threadId: number) {
    await this.getThreadOrThrow(tenantId, userId, threadId);
    await this.threadRepo.delete({ id: threadId });
  }

  /**
   * ส่งข้อความผู้ใช้ → สตรีมคำตอบ AI ทีละ token ผ่าน `onToken`
   * จัดการ thread/ประวัติ/quota/usage ครบ คืนค่า id และเนื้อหาสุดท้าย
   */
  async streamReply(
    params: StreamReplyParams,
    onToken: (delta: string) => void,
  ): Promise<StreamReplyResult> {
    const { tenantId, userId, message } = params;
    const locale = params.locale === 'en' ? 'en' : 'th';

    if (!this.openai.isConfigured()) {
      throw new AppException('ai.notConfigured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    await this.ai.assertWithinQuota(tenantId);

    const thread = params.threadId
      ? await this.getThreadOrThrow(tenantId, userId, params.threadId)
      : await this.createThread(tenantId, userId, message);

    const userMessage = await this.messageRepo.save(
      this.messageRepo.create({ threadId: thread.id, role: 'user', content: message }),
    );

    const history = await this.messageRepo.find({
      where: { threadId: thread.id },
      order: { createdAt: 'DESC' },
      take: MAX_CONTEXT_MESSAGES,
    });
    history.reverse();

    const messages: ChatMessageInput[] = [
      { role: 'system', content: SYSTEM_PROMPT[locale] },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const result = await this.openai.streamChat(messages, onToken);

      const assistantMessage = await this.messageRepo.save(
        this.messageRepo.create({
          threadId: thread.id,
          role: 'assistant',
          content: result.content,
        }),
      );

      await this.ai.addUsage(tenantId, result.promptTokens + result.completionTokens);

      return {
        threadId: thread.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        content: result.content,
        tokens: {
          prompt: result.promptTokens,
          completion: result.completionTokens,
          total: result.promptTokens + result.completionTokens,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`chat stream failed: ${msg}`);
      throw new AppException('chat.replyFailed', HttpStatus.BAD_GATEWAY);
    }
  }
}
