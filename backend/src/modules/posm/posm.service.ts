import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { PosmProject } from '../../database/entities';
import { OpenAiService } from '../ai/openai.service';
import { CreatePosmDto } from './dto/create-posm.dto';

const TYPE_LABEL: Record<string, string> = {
  price_tag:     'ป้ายราคา',
  shelf_talker:  'Shelf Talker',
  wobbler:       'Wobbler',
  promotion_a4:  'โปสเตอร์ A4',
  review_poster: 'Google Review Poster',
  sale_tag:      'ป้ายลดราคา',
};

@Injectable()
export class PosmService {
  private readonly logger = new Logger(PosmService.name);

  constructor(
    @InjectRepository(PosmProject) private readonly repo: Repository<PosmProject>,
    private readonly openai: OpenAiService,
  ) {}

  findAll(tenantId: number) {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async findOne(tenantId: number, id: number) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundAppException();
    return item;
  }

  async generate(tenantId: number, userId: number | null, dto: CreatePosmDto) {
    const project = this.repo.create({
      tenantId,
      userId,
      type: dto.type,
      productName: dto.productName,
      price: dto.price ?? null,
      promotion: dto.promotion ?? null,
      status: 'pending',
    });
    const saved = await this.repo.save(project);

    let headline: string | null = null;
    if (this.openai.isConfigured()) {
      try {
        const result = await this.openai.complete(
          'คุณเป็นนักออกแบบสื่อการตลาดสำหรับร้านค้าปลีก ตอบเฉพาะข้อความพาดหัว (headline) สั้นๆ ไม่เกิน 20 คำ ไม่ต้องมีคำอธิบายเพิ่มเติม',
          `สร้าง headline สำหรับ ${TYPE_LABEL[dto.type] ?? dto.type} ของสินค้า: "${dto.productName}"` +
          (dto.price != null ? ` ราคา ${dto.price} บาท` : '') +
          (dto.promotion ? ` โปรโมชั่น: ${dto.promotion}` : ''),
        );
        headline = result.content;
      } catch (err) {
        this.logger.warn('AI headline generation failed', err);
      }
    }

    saved.status = 'done';
    await this.repo.save(saved);

    return { ...saved, headline };
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const item = await this.findOne(tenantId, id);
    await this.repo.remove(item);
  }
}
