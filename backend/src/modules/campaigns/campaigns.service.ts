import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { Campaign, Promotion } from '../../database/entities';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(Promotion) private readonly promotionRepo: Repository<Promotion>,
  ) {}

  // ---------- campaigns ----------

  findAll(tenantId: number) {
    return this.campaignRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: number, id: number) {
    const campaign = await this.campaignRepo.findOne({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundAppException();
    return campaign;
  }

  create(tenantId: number, userId: number | null, dto: CreateCampaignDto) {
    return this.campaignRepo.save(
      this.campaignRepo.create({
        tenantId,
        createdBy: userId,
        name: dto.name,
        objective: dto.objective ?? null,
        channel: dto.channel ?? null,
        status: dto.status ?? 'draft',
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
      }),
    );
  }

  async update(tenantId: number, id: number, dto: UpdateCampaignDto) {
    const campaign = await this.findOne(tenantId, id);
    Object.assign(campaign, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.objective !== undefined && { objective: dto.objective }),
      ...(dto.channel !== undefined && { channel: dto.channel }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate }),
      ...(dto.endDate !== undefined && { endDate: dto.endDate }),
    });
    return this.campaignRepo.save(campaign);
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const campaign = await this.findOne(tenantId, id);
    await this.campaignRepo.remove(campaign);
  }

  // ---------- promotions ----------

  async findPromotions(tenantId: number, campaignId?: number) {
    const where = campaignId ? { tenantId, campaignId } : { tenantId };
    return this.promotionRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async createPromotion(tenantId: number, dto: CreatePromotionDto) {
    if (dto.campaignId) {
      // ตรวจสอบว่า campaign เป็นของ tenant นี้จริง
      await this.findOne(tenantId, dto.campaignId);
    }
    return this.promotionRepo.save(
      this.promotionRepo.create({
        tenantId,
        campaignId: dto.campaignId ?? null,
        title: dto.title,
        discountType: dto.discountType ?? 'percent',
        discountValue: dto.discountValue ?? 0,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
      }),
    );
  }

  async removePromotion(tenantId: number, id: number): Promise<void> {
    const promotion = await this.promotionRepo.findOne({ where: { id, tenantId } });
    if (!promotion) throw new NotFoundAppException();
    await this.promotionRepo.remove(promotion);
  }
}
