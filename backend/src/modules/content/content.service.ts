import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { ContentItem } from '../../database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateContentDto } from './dto/create-content.dto';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentItem) private readonly contentRepo: Repository<ContentItem>,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(tenantId: number) {
    return this.contentRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async findOne(tenantId: number, id: number) {
    const item = await this.contentRepo.findOne({ where: { id, tenantId } });
    if (!item) {
      throw new NotFoundAppException();
    }
    return item;
  }

  async create(tenantId: number, userId: number | null, dto: CreateContentDto) {
    const item = this.contentRepo.create({
      tenantId,
      createdBy: userId,
      type: dto.type,
      title: dto.title ?? null,
      body: dto.body,
      channel: dto.channel ?? null,
      locale: dto.locale ?? 'th',
      aiRequestId: dto.aiRequestId ?? null,
      status: 'draft',
    });
    const saved = await this.contentRepo.save(item);

    await this.notifications.create({
      tenantId,
      userId,
      type: 'content',
      title: 'บันทึกคอนเทนต์แล้ว',
      body: 'คอนเทนต์ถูกบันทึกเป็นแบบร่างเรียบร้อย',
    });

    return saved;
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const item = await this.findOne(tenantId, id);
    await this.contentRepo.remove(item);
  }
}
