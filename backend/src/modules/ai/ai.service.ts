import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../../common/exceptions/app.exception';
import { AiConfig } from '../../config/configuration';
import { AiRequest, AiUsage } from '../../database/entities';
import { GenerateContentDto } from './dto/generate-content.dto';
import { GenerateBatchDto } from './dto/generate-batch.dto';
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
    const limit = this.aiConfig.monthlyTokenLimit ?? 500_000;
    return {
      periodMonth,
      totalTokens,
      totalRequests: usage?.totalRequests ?? 0,
      limit,
      remaining: Math.max(0, limit - totalTokens),
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

  async generateBatch(
    tenantId: number,
    userId: number | null,
    dto: GenerateBatchDto,
  ): Promise<{
    results: Array<{
      sku: string | null;
      productName: string;
      type: string;
      ok: boolean;
      content?: string;
      aiRequestId?: number;
      tokens?: { prompt: number; completion: number; total: number };
      error?: string;
    }>;
    succeeded: number;
    failed: number;
    totalTokens: number;
  }> {
    const results: Array<{
      sku: string | null;
      productName: string;
      type: string;
      ok: boolean;
      content?: string;
      aiRequestId?: number;
      tokens?: { prompt: number; completion: number; total: number };
      error?: string;
    }> = [];
    let totalTokens = 0;

    for (const product of dto.products) {
      const promoDetails = [
        product.details,
        dto.campaignName ? `Campaign: ${dto.campaignName}` : '',
        product.campaignName ? `โปร ERP: ${product.campaignName}` : '',
      ].filter(Boolean).join('\n');

      for (const type of dto.types) {
        try {
          const result = await this.generate(tenantId, userId, {
            type,
            productName: product.productName,
            price: product.price,
            details: promoDetails || undefined,
            tone: dto.tone,
            locale: dto.locale,
          });
          totalTokens += result.tokens.total;
          results.push({
            sku: product.sku ?? null,
            productName: product.productName,
            type,
            ok: true,
            content: result.content,
            aiRequestId: result.aiRequestId,
            tokens: result.tokens,
          });
        } catch (err) {
          results.push({
            sku: product.sku ?? null,
            productName: product.productName,
            type,
            ok: false,
            error: err instanceof Error ? err.message : 'generation failed',
          });
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    return {
      results,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      totalTokens,
    };
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
