import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { GoogleReview } from '../../database/entities';
import { OpenAiService } from '../ai/openai.service';
import { CreateReviewDto } from './dto/create-review.dto';

const SENTIMENT_PROMPT: Record<string, string> = {
  positive: 'รีวิวเชิงบวก — ตอบขอบคุณอบอุ่นและเชิญมาใช้บริการอีกครั้ง',
  neutral:  'รีวิวกลางๆ — รับทราบและบอกจะปรับปรุง',
  negative: 'รีวิวเชิงลบ — ขอโทษจริงใจ ขอแก้ไขและขอช่องทางติดต่อ',
};

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(GoogleReview) private readonly repo: Repository<GoogleReview>,
    private readonly openai: OpenAiService,
  ) {}

  findAll(tenantId: number, branchId?: number) {
    return this.repo.find({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async findOne(tenantId: number, id: number) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundAppException();
    return item;
  }

  async create(tenantId: number, dto: CreateReviewDto) {
    const sentiment = dto.sentiment ?? this.guessSentiment(dto.rating);
    const review = this.repo.create({
      tenantId,
      branchId: dto.branchId ?? null,
      author: dto.author ?? null,
      rating: dto.rating,
      text: dto.text ?? null,
      sentiment,
      reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null,
    });
    return this.repo.save(review);
  }

  async generateReply(tenantId: number, id: number): Promise<{ aiReply: string }> {
    const review = await this.findOne(tenantId, id);
    const sentiment = review.sentiment ?? 'neutral';
    const hint = SENTIMENT_PROMPT[sentiment] ?? SENTIMENT_PROMPT['neutral'];

    let aiReply = this.defaultReply(sentiment);
    if (this.openai.isConfigured()) {
      try {
        const result = await this.openai.complete(
          `คุณเป็นพนักงานบริการลูกค้าของ "100 Baht Shop Thailand" ตอบรีวิว Google ภาษาไทย สุภาพ กระชับ ไม่เกิน 3 ประโยค ${hint}`,
          `รีวิว ${review.rating} ดาว โดย ${review.author ?? 'ลูกค้า'}: "${review.text ?? '(ไม่มีข้อความ)'}"`,
        );
        aiReply = result.content;
      } catch (err) {
        this.logger.warn('AI reply generation failed', err);
      }
    }

    review.aiReply = aiReply;
    await this.repo.save(review);
    return { aiReply };
  }

  async markReplied(tenantId: number, id: number) {
    const review = await this.findOne(tenantId, id);
    review.repliedAt = new Date();
    return this.repo.save(review);
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const item = await this.findOne(tenantId, id);
    await this.repo.remove(item);
  }

  async getStats(tenantId: number) {
    const all = await this.repo.find({ where: { tenantId } });
    const total = all.length;
    const avg = total ? all.reduce((s, r) => s + r.rating, 0) / total : 0;
    const negative = all.filter((r) => r.sentiment === 'negative').length;
    const unreplied = all.filter((r) => !r.repliedAt && r.sentiment !== 'positive').length;
    return { total, avgRating: Math.round(avg * 10) / 10, negative, unreplied };
  }

  private guessSentiment(rating: number): 'positive' | 'neutral' | 'negative' {
    if (rating >= 4) return 'positive';
    if (rating === 3) return 'neutral';
    return 'negative';
  }

  private defaultReply(sentiment: string): string {
    if (sentiment === 'positive') return 'ขอบคุณมากเลยนะคะที่ให้เกียรติมาใช้บริการและฝากรีวิวดีๆ ไว้ ทีมงาน 100 Baht Shop Thailand ยินดีต้อนรับเสมอค่ะ 🙏';
    if (sentiment === 'negative') return 'ขออภัยในความไม่สะดวกค่ะ ทีมงานรับทราบแล้วและจะเร่งปรับปรุงทันที หากต้องการแจ้งรายละเอียดเพิ่มเติม ติดต่อเราได้โดยตรงค่ะ';
    return 'ขอบคุณสำหรับ Feedback นะคะ เราจะนำไปปรับปรุงบริการเพื่อให้ดียิ่งขึ้นค่ะ';
  }
}
