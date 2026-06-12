import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { ListeningKeyword, SocialMention } from '../../database/entities';
import { CreateKeywordDto } from './dto/create-keyword.dto';
import { CreateMentionDto } from './dto/create-mention.dto';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(SocialMention) private readonly mentionRepo: Repository<SocialMention>,
    @InjectRepository(ListeningKeyword) private readonly keywordRepo: Repository<ListeningKeyword>,
  ) {}

  // ─── Mentions ────────────────────────────────────────────────

  findAllMentions(tenantId: number, limit = 100) {
    return this.mentionRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async createMention(tenantId: number, dto: CreateMentionDto) {
    const mention = this.mentionRepo.create({
      tenantId,
      platform: dto.platform,
      keyword: dto.keyword,
      text: dto.text,
      authorHandle: dto.authorHandle ?? null,
      sentiment: dto.sentiment ?? null,
      isViral: dto.isViral ?? false,
      sourceUrl: dto.sourceUrl ?? null,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
    });
    return this.mentionRepo.save(mention);
  }

  async removeMention(tenantId: number, id: number): Promise<void> {
    const item = await this.mentionRepo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundAppException();
    await this.mentionRepo.remove(item);
  }

  async getMentionStats(tenantId: number) {
    const all = await this.mentionRepo.find({ where: { tenantId } });
    return {
      total: all.length,
      positive: all.filter((m) => m.sentiment === 'positive').length,
      negative: all.filter((m) => m.sentiment === 'negative').length,
      viral: all.filter((m) => m.isViral).length,
    };
  }

  // ─── Keywords ────────────────────────────────────────────────

  findAllKeywords(tenantId: number) {
    return this.keywordRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async createKeyword(tenantId: number, dto: CreateKeywordDto) {
    const kw = this.keywordRepo.create({
      tenantId,
      keyword: dto.keyword,
      isActive: dto.isActive ?? true,
    });
    return this.keywordRepo.save(kw);
  }

  async removeKeyword(tenantId: number, id: number): Promise<void> {
    const item = await this.keywordRepo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundAppException();
    await this.keywordRepo.remove(item);
  }
}
