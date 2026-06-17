import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ChannelConfig } from '../../database/entities';
import { ContentItem } from '../../database/entities';
import { ChannelService } from '../inbox/channel.service';
import { NotificationsService } from '../notifications/notifications.service';
import { defaultChannelForType } from './content-types';
import { CreateContentDto } from './dto/create-content.dto';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentItem) private readonly contentRepo: Repository<ContentItem>,
    @InjectRepository(ChannelConfig) private readonly channelRepo: Repository<ChannelConfig>,
    private readonly notifications: NotificationsService,
    private readonly channelService: ChannelService,
  ) {}

  async findAll(tenantId: number) {
    return this.contentRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 500,
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
    const channel = dto.channel ?? defaultChannelForType(dto.type);
    const item = this.contentRepo.create({
      tenantId,
      createdBy: userId,
      type: dto.type as ContentItem['type'],
      title: dto.title ?? null,
      body: dto.body,
      channel,
      locale: dto.locale ?? 'th',
      aiRequestId: dto.aiRequestId ?? null,
      sku: dto.sku?.replace(/\s+/g, '').toUpperCase() || null,
      campaignId: dto.campaignId ?? null,
      campaignName: dto.campaignName ?? null,
      productName: dto.productName ?? null,
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

  async updateStatus(
    tenantId: number,
    id: number,
    status: ContentItem['status'],
  ) {
    const item = await this.findOne(tenantId, id);
    item.status = status;
    if (status === 'published') {
      item.scheduledAt = null;
    }
    return this.contentRepo.save(item);
  }

  async schedule(tenantId: number, id: number, scheduledAt: Date) {
    const item = await this.findOne(tenantId, id);
    item.scheduledAt = scheduledAt;
    item.status = 'scheduled';
    return this.contentRepo.save(item);
  }

  async publishLine(
    tenantId: number,
    userId: number | null,
    id: number,
    lineUserId?: string,
  ) {
    const item = await this.findOne(tenantId, id);
    const text = item.body?.trim();
    if (!text) {
      throw new AppException('content.emptyBody', HttpStatus.BAD_REQUEST);
    }

    const lineChannel = await this.channelRepo.findOne({
      where: { tenantId, channel: 'line', isActive: true },
      order: { id: 'ASC' },
    });

    if (!lineChannel) {
      return {
        ok: false,
        mode: 'manual',
        message: 'ยังไม่ได้ตั้งค่า LINE OA — คัดลอกข้อความไปส่งใน LINE Official Account Manager ด้วยตนเอง',
        preview: text.slice(0, 200),
      };
    }

    if (lineUserId) {
      await this.channelService.pushLine(lineChannel, lineUserId, text);
      item.status = 'published';
      item.channel = 'line';
      await this.contentRepo.save(item);
      await this.notifications.create({
        tenantId,
        userId,
        type: 'content',
        title: 'ส่ง LINE แล้ว',
        body: `ส่งข้อความไปยัง ${lineUserId}`,
      });
      return { ok: true, mode: 'push', message: 'ส่งข้อความ LINE สำเร็จ' };
    }

    const broadcast = await this.channelService.broadcastLine(lineChannel, text);
    if (broadcast.ok) {
      item.status = 'published';
      item.channel = 'line';
      await this.contentRepo.save(item);
      return { ok: true, mode: 'broadcast', message: broadcast.message };
    }

    return {
      ok: false,
      mode: 'manual',
      message: broadcast.message,
      preview: text.slice(0, 200),
    };
  }

  async publishGbp(tenantId: number, id: number) {
    const item = await this.findOne(tenantId, id);
    const text = item.body?.trim();
    if (!text) {
      throw new AppException('content.emptyBody', HttpStatus.BAD_REQUEST);
    }

    // GBP API auto-post is Phase 11 — mark ready and return copy instructions
    item.status = 'published';
    item.channel = 'google_business';
    await this.contentRepo.save(item);

    return {
      ok: true,
      mode: 'manual',
      message: 'บันทึกสถานะ published แล้ว — วางข้อความใน Google Business Profile ด้วยตนเอง (API อัตโนมัติอยู่ใน roadmap)',
      body: text,
    };
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const item = await this.findOne(tenantId, id);
    await this.contentRepo.remove(item);
  }
}
