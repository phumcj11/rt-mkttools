import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { AppException } from '../../common/exceptions/app.exception';
import { ChannelConfig, ContentAsset, ContentPublishJob } from '../../database/entities';
import { ContentItem } from '../../database/entities';
import { ChannelService } from '../inbox/channel.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BlotatoService } from './blotato.service';
import { defaultChannelForType } from './content-types';
import { CreateContentDto } from './dto/create-content.dto';
import { ManusContentService } from './manus-content.service';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentItem) private readonly contentRepo: Repository<ContentItem>,
    @InjectRepository(ContentAsset) private readonly assetRepo: Repository<ContentAsset>,
    @InjectRepository(ContentPublishJob) private readonly publishJobRepo: Repository<ContentPublishJob>,
    @InjectRepository(ChannelConfig) private readonly channelRepo: Repository<ChannelConfig>,
    private readonly notifications: NotificationsService,
    private readonly channelService: ChannelService,
    private readonly manus: ManusContentService,
    private readonly blotato: BlotatoService,
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

  async listAssets(tenantId: number, contentItemId: number) {
    await this.findOne(tenantId, contentItemId);
    return this.assetRepo.find({
      where: { tenantId, contentItemId },
      order: { createdAt: 'DESC' },
    });
  }

  async generateManusAsset(
    tenantId: number,
    userId: number | null,
    id: number,
    dto: { sourceImageUrl?: string; prompt?: string; platform?: string },
  ) {
    const item = await this.findOne(tenantId, id);
    const prompt = this.buildManusPrompt(item, dto.prompt, dto.platform);
    const asset = await this.assetRepo.save(this.assetRepo.create({
      tenantId,
      contentItemId: item.id,
      sku: item.sku,
      productName: item.productName,
      source: 'manus',
      status: 'generating',
      sourceImageUrl: dto.sourceImageUrl ?? null,
      prompt,
      createdBy: userId,
    }));

    try {
      const task = await this.manus.createImageTask({
        title: `Content visual ${item.sku ?? item.id}`,
        prompt,
        sourceImageUrl: dto.sourceImageUrl,
        sku: item.sku,
      });
      asset.manusTaskId = task.taskId;
      asset.manusTaskUrl = task.taskUrl;
      return this.assetRepo.save(asset);
    } catch (err) {
      asset.status = 'failed';
      asset.errorMessage = err instanceof Error ? err.message : String(err);
      await this.assetRepo.save(asset);
      throw err;
    }
  }

  async refreshManusAsset(tenantId: number, contentItemId: number, assetId: number) {
    await this.findOne(tenantId, contentItemId);
    const asset = await this.assetRepo.findOne({ where: { id: assetId, tenantId, contentItemId } });
    if (!asset) throw new NotFoundAppException();
    if (!asset.manusTaskId) return asset;

    const messages = await this.manus.listTaskMessages(asset.manusTaskId);
    const imageUrl = this.manus.extractImageUrl(messages);
    if (imageUrl) {
      asset.imageUrl = imageUrl;
      asset.status = 'ready';
      asset.errorMessage = null;
      return this.assetRepo.save(asset);
    }
    return asset;
  }

  async updateAssetStatus(
    tenantId: number,
    contentItemId: number,
    assetId: number,
    status: 'approved' | 'rejected',
  ) {
    await this.findOne(tenantId, contentItemId);
    const asset = await this.assetRepo.findOne({ where: { id: assetId, tenantId, contentItemId } });
    if (!asset) throw new NotFoundAppException();
    if (status === 'approved' && !asset.imageUrl) {
      throw new AppException('content.assetImageMissing', HttpStatus.BAD_REQUEST);
    }
    asset.status = status;
    return this.assetRepo.save(asset);
  }

  async applyManusWebhook(payload: unknown) {
    const taskId = this.extractTaskId(payload);
    if (!taskId) return { ok: false, message: 'missing task id' };
    const asset = await this.assetRepo.findOne({ where: { manusTaskId: taskId } });
    if (!asset) return { ok: false, message: 'asset not found' };
    const imageUrl = this.manus.extractImageUrl(payload);
    if (imageUrl) {
      asset.imageUrl = imageUrl;
      asset.status = 'ready';
      asset.errorMessage = null;
    } else {
      const stopReason = JSON.stringify(payload).includes('"ask"') ? 'Manus task needs user input' : null;
      if (stopReason) asset.errorMessage = stopReason;
    }
    await this.assetRepo.save(asset);
    return { ok: true, assetId: asset.id };
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

  async publishBlotato(
    tenantId: number,
    userId: number | null,
    contentItemId: number,
    dto: { platform: string; assetId?: number; scheduledAt?: string },
  ) {
    const item = await this.findOne(tenantId, contentItemId);
    const text = item.body?.trim();
    if (!text) throw new AppException('content.emptyBody', HttpStatus.BAD_REQUEST);

    let asset: ContentAsset | null = null;
    if (dto.assetId) {
      asset = await this.assetRepo.findOne({ where: { id: dto.assetId, tenantId, contentItemId } });
    } else {
      asset = await this.assetRepo.findOne({
        where: { tenantId, contentItemId, status: 'approved' },
        order: { updatedAt: 'DESC' },
      });
    }
    if (!asset || asset.status !== 'approved' || !asset.imageUrl) {
      throw new AppException('content.approvedAssetRequired', HttpStatus.BAD_REQUEST);
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : item.scheduledAt;
    const request = {
      text,
      mediaUrls: [asset.imageUrl],
      platform: dto.platform,
      scheduledAt,
    };
    const job = await this.publishJobRepo.save(this.publishJobRepo.create({
      tenantId,
      contentItemId,
      assetId: asset.id,
      provider: 'blotato',
      platform: dto.platform,
      status: 'queued',
      scheduledAt: scheduledAt ?? null,
      request: request as unknown as Record<string, unknown>,
      createdBy: userId,
    }));

    try {
      const response = await this.blotato.createPost(request);
      const submissionId = this.extractBlotatoSubmissionId(response);
      job.status = 'submitted';
      job.blotatoSubmissionId = submissionId;
      job.response = response;
      item.channel = dto.platform;
      item.status = scheduledAt ? 'scheduled' : 'published';
      await Promise.all([this.publishJobRepo.save(job), this.contentRepo.save(item)]);
      return job;
    } catch (err) {
      job.status = 'failed';
      job.errorMessage = err instanceof Error ? err.message : String(err);
      await this.publishJobRepo.save(job);
      throw err;
    }
  }

  async refreshPublishJob(tenantId: number, jobId: number) {
    const job = await this.publishJobRepo.findOne({ where: { id: jobId, tenantId } });
    if (!job) throw new NotFoundAppException();
    if (!job.blotatoSubmissionId) return job;
    const response = await this.blotato.getPostStatus(job.blotatoSubmissionId);
    job.response = response;
    const status = String(response.status ?? '').toLowerCase();
    if (status === 'published') {
      job.status = 'published';
      job.publicUrl = typeof response.publicUrl === 'string' ? response.publicUrl : job.publicUrl;
      const item = await this.contentRepo.findOne({ where: { id: job.contentItemId, tenantId } });
      if (item) {
        item.status = 'published';
        await this.contentRepo.save(item);
      }
    } else if (status === 'failed') {
      job.status = 'failed';
      job.errorMessage = typeof response.errorMessage === 'string' ? response.errorMessage : 'Blotato publish failed';
    }
    return this.publishJobRepo.save(job);
  }

  async listPublishJobs(tenantId: number, contentItemId: number) {
    await this.findOne(tenantId, contentItemId);
    return this.publishJobRepo.find({
      where: { tenantId, contentItemId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const item = await this.findOne(tenantId, id);
    await this.contentRepo.remove(item);
  }

  private buildManusPrompt(item: ContentItem, customPrompt?: string, platform = 'facebook'): string {
    return [
      `Create a polished marketing image for ${platform}.`,
      `Product: ${item.productName ?? item.sku ?? 'product'}`,
      item.sku ? `SKU: ${item.sku}` : '',
      item.campaignName ? `Campaign / promotion: ${item.campaignName}` : '',
      item.body ? `Caption context: ${item.body.slice(0, 1200)}` : '',
      'Use the connected Manus Project brand template and visual rules.',
      'Keep product packaging accurate. Do not invent claims, discounts, or prices.',
      'Output one final image suitable for approval before publishing.',
      customPrompt ? `Additional creative direction: ${customPrompt}` : '',
    ].filter(Boolean).join('\n');
  }

  private extractTaskId(payload: unknown): string | null {
    const json = payload as Record<string, unknown>;
    const task = (json.task_detail ?? json.task ?? json) as Record<string, unknown>;
    const id = task.task_id ?? task.id ?? json.task_id;
    return typeof id === 'string' ? id : null;
  }

  private extractBlotatoSubmissionId(response: Record<string, unknown>): string | null {
    const direct = response.postSubmissionId ?? response.id ?? response.submissionId;
    if (typeof direct === 'string') return direct;
    const post = response.post as Record<string, unknown> | undefined;
    const nested = post?.postSubmissionId ?? post?.id;
    return typeof nested === 'string' ? nested : null;
  }
}
