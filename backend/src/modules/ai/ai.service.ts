import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { AiConfig } from '../../config/configuration';
import { AiRequest, AiUsage } from '../../database/entities';
import { GenerateContentDto } from './dto/generate-content.dto';
import { OpenAiService } from './openai.service';
import {
  CONTENT_TEMPLATES,
  buildSystemPrompt,
  buildUserPrompt,
} from './templates';

export interface GenerateResult {
  content: string;
  type: string;
  aiRequestId: number;
  tokens: { prompt: number; completion: number; total: number };
}

export interface UsageSummary {
  periodMonth: string;
  totalTokens: number;
  totalRequests: number;
  limit: number;
  remaining: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiConfig: AiConfig;

  constructor(
    @InjectRepository(AiRequest) private readonly requestRepo: Repository<AiRequest>,
    @InjectRepository(AiUsage) private readonly usageRepo: Repository<AiUsage>,
    private readonly openai: OpenAiService,
    config: ConfigService,
  ) {
    this.aiConfig = config.getOrThrow<AiConfig>('ai');
  }

  getTemplates() {
    return CONTENT_TEMPLATES;
  }

  async getUsage(tenantId: number): Promise<UsageSummary> {
    const periodMonth = this.currentPeriod();
    const usage = await this.usageRepo.findOne({ where: { tenantId, periodMonth } });
    const totalTokens = usage?.totalTokens ?? 0;
    return {
      periodMonth,
      totalTokens,
      totalRequests: usage?.totalRequests ?? 0,
      limit: this.aiConfig.monthlyTokenLimit,
      remaining: Math.max(0, this.aiConfig.monthlyTokenLimit - totalTokens),
    };
  }

  async generate(
    tenantId: number,
    userId: number | null,
    dto: GenerateContentDto,
  ): Promise<GenerateResult> {
    if (!this.openai.isConfigured()) {
      throw new AppException('ai.notConfigured', HttpStatus.SERVICE_UNAVAILABLE);
    }

    await this.assertWithinQuota(tenantId);

    const locale = dto.locale ?? 'th';
    const systemPrompt = buildSystemPrompt(locale);
    const userPrompt = buildUserPrompt({ ...dto, locale });

    const request = await this.requestRepo.save(
      this.requestRepo.create({
        tenantId,
        userId,
        model: this.aiConfig.model,
        prompt: userPrompt,
        status: 'pending',
      }),
    );

    try {
      const result = await this.openai.complete(systemPrompt, userPrompt);

      await this.requestRepo.update(request.id, {
        response: result.content,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        model: result.model,
        status: 'success',
      });

      await this.addUsage(tenantId, result.promptTokens + result.completionTokens);

      return {
        content: result.content,
        type: dto.type,
        aiRequestId: request.id,
        tokens: {
          prompt: result.promptTokens,
          completion: result.completionTokens,
          total: result.promptTokens + result.completionTokens,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`AI generate failed: ${message}`);
      await this.requestRepo.update(request.id, {
        status: 'error',
        errorMessage: message.slice(0, 500),
      });
      throw new AppException('ai.generationFailed', HttpStatus.BAD_GATEWAY);
    }
  }

  // ---------- helpers (public: shared with chat) ----------

  async assertWithinQuota(tenantId: number): Promise<void> {
    const usage = await this.getUsage(tenantId);
    if (usage.totalTokens >= usage.limit) {
      throw new AppException('ai.quotaExceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async addUsage(tenantId: number, tokens: number): Promise<void> {
    const periodMonth = this.currentPeriod();
    const existing = await this.usageRepo.findOne({ where: { tenantId, periodMonth } });
    if (existing) {
      await this.usageRepo.update(existing.id, {
        totalTokens: Number(existing.totalTokens) + tokens,
        totalRequests: existing.totalRequests + 1,
      });
    } else {
      await this.usageRepo.save(
        this.usageRepo.create({
          tenantId,
          periodMonth,
          totalTokens: tokens,
          totalRequests: 1,
        }),
      );
    }
  }

  private currentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
  }
}
