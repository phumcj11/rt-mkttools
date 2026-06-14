import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import sharp from 'sharp';
import {
  SignAiResult,
  SignDraft,
  SignExport,
  SignRequest,
  SignRequestAsset,
  SignRequestStatus,
  SignReview,
  SignReviewDecision,
  SignTemplate,
  ErpProductCache,
  ProductPromotionSnapshot,
} from '../../database/entities';
import { OpenAiService } from '../ai/openai.service';
import { DriveService } from '../media/drive.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSignRequestDto, SignAssetInputDto } from './dto/create-sign-request.dto';
import { RespondSignRequestDto } from './dto/respond-sign-request.dto';
import { ReviewSignRequestDto } from './dto/review-sign-request.dto';
import { UpdateSignDraftDto } from './dto/update-sign-draft.dto';
import { UploadTemplateDto } from './dto/upload-template.dto';
import { composeShelfMockup } from './sign-shelf-mockup';

const SIGN_TYPE_LABELS: Record<string, string> = {
  price_tag: 'ป้ายราคา',
  promotion: 'ป้ายโปร',
  benefit_card: 'ป้ายสรรพคุณ',
  shelf_tag: 'ป้ายติดชั้น',
};

const SIGN_SIZE_LABELS: Record<string, string> = {
  a5: 'A5 (ใหญ่)',
  a6: 'A6 (กลาง)',
  a7: 'A7 (เล็ก)',
  shelf_tag: 'ติดขอบชั้น 8×5 ซม.',
};

export interface SignDetail extends SignRequest {
  assets: SignRequestAsset[];
  aiResult: SignAiResult | null;
  latestDraft: SignDraft | null;
  reviews: SignReview[];
  exports: SignExport[];
}

@Injectable()
export class SignsService {
  private readonly logger = new Logger(SignsService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'signs');

  constructor(
    @InjectRepository(SignRequest) private readonly requests: Repository<SignRequest>,
    @InjectRepository(SignRequestAsset) private readonly assets: Repository<SignRequestAsset>,
    @InjectRepository(SignAiResult) private readonly aiResults: Repository<SignAiResult>,
    @InjectRepository(SignDraft) private readonly drafts: Repository<SignDraft>,
    @InjectRepository(SignReview) private readonly reviews: Repository<SignReview>,
    @InjectRepository(SignExport) private readonly exportsRepo: Repository<SignExport>,
    @InjectRepository(SignTemplate) private readonly templates: Repository<SignTemplate>,
    @InjectRepository(ErpProductCache) private readonly productCache: Repository<ErpProductCache>,
    @InjectRepository(ProductPromotionSnapshot) private readonly promoCache: Repository<ProductPromotionSnapshot>,
    private readonly openai: OpenAiService,
    private readonly notifications: NotificationsService,
    private readonly drive: DriveService,
  ) {
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async listTemplates(tenantId: number): Promise<SignTemplate[]> {
    return this.templates.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async uploadTemplate(tenantId: number, dto: UploadTemplateDto): Promise<SignTemplate> {
    const parsed = this.parseDataUrl(dto.dataUrl);
    const ext = parsed.mimeType.includes('jpeg') ? 'jpg' : 'png';
    const filename = `tmpl-${tenantId}-${Date.now()}.${ext}`;
    const localPath = path.join(this.uploadDir, filename);
    fs.writeFileSync(localPath, parsed.buffer);
    return this.templates.save(this.templates.create({
      tenantId,
      name: dto.name.trim(),
      signType: dto.signType ?? null,
      signSize: dto.signSize ?? null,
      filename,
      url: `/signs/serve/${filename}`,
      isActive: true,
    }));
  }

  async deleteTemplate(tenantId: number, id: number): Promise<{ message: string }> {
    const tpl = await this.templates.findOne({ where: { tenantId, id } });
    if (!tpl) throw new NotFoundException('Template not found');
    const localPath = path.join(this.uploadDir, tpl.filename);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    await this.templates.remove(tpl);
    return { message: 'ลบ Template แล้ว' };
  }

  async list(tenantId: number, status?: SignRequestStatus): Promise<SignRequest[]> {
    return this.requests.find({
      where: status ? { tenantId, status } : { tenantId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async reviewQueue(tenantId: number): Promise<SignRequest[]> {
    return this.requests.find({
      where: { tenantId, status: 'pending_review' },
      order: { createdAt: 'ASC' },
      take: 100,
    });
  }

  async findDetail(tenantId: number, id: number): Promise<SignDetail> {
    const request = await this.findRequest(tenantId, id);
    const [assets, aiResult, latestDraft, reviews, exports] = await Promise.all([
      this.assets.find({ where: { tenantId, requestId: id }, order: { createdAt: 'ASC' } }),
      this.aiResults.findOne({ where: { tenantId, requestId: id }, order: { createdAt: 'DESC' } }),
      this.drafts.findOne({ where: { tenantId, requestId: id }, order: { version: 'DESC' } }),
      this.reviews.find({ where: { tenantId, requestId: id }, order: { createdAt: 'DESC' } }),
      this.exportsRepo.find({ where: { tenantId, requestId: id }, order: { createdAt: 'DESC' } }),
    ]);
    return Object.assign(request, { assets, aiResult, latestDraft, reviews, exports });
  }

  async create(tenantId: number, requesterId: number, dto: CreateSignRequestDto): Promise<SignDetail> {
    const catalog = dto.sku?.trim() ? await this.lookupCatalogProduct(dto.sku.trim()) : null;
    const assets = [...(dto.assets ?? [])];
    if (catalog?.imageUrl && !assets.some((a) => a.kind === 'product')) {
      const imageAsset = await this.catalogImageAsAsset(catalog.imageUrl, catalog.sku);
      if (imageAsset) assets.unshift(imageAsset);
    }

    let signType = dto.signType;
    let signSize = dto.signSize;
    let templateId: number | null = dto.templateId ?? null;

    if (templateId) {
      const tpl = await this.templates.findOne({ where: { id: templateId, tenantId, isActive: true } });
      if (!tpl) throw new BadRequestException('ไม่พบ Template ที่เลือก');
      signType = tpl.signType ?? signType;
      signSize = tpl.signSize ?? signSize;
    }

    const request = await this.requests.save(this.requests.create({
      tenantId,
      requesterId,
      reviewerId: null,
      requestNo: this.makeRequestNo(),
      branchName: dto.branchName.trim(),
      requesterName: dto.requesterName.trim(),
      sku: catalog?.sku ?? (dto.sku?.trim() || null),
      productName: catalog?.name ?? dto.productName.trim(),
      price: dto.price ?? catalog?.retailPrice ?? null,
      promotion: dto.promotion?.trim() || catalog?.promotionText || null,
      signType,
      signSize,
      templateId,
      headline: dto.headline?.trim() || null,
      benefits: dto.benefits?.trim() || null,
      notes: dto.notes?.trim() || null,
      status: 'submitted',
      statusNote: null,
      approvedAt: null,
      exportedAt: null,
    }));

    await this.saveAssets(tenantId, request.id, assets);
    await this.transition(request, 'ai_processing', 'AI กำลังอ่านข้อมูลและสร้าง Draft');
    try {
      await this.processAiAndDraft(request, requesterId);
      await this.notifyMarketing(tenantId, request);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.transition(request, 'ai_processing', `สร้าง Draft ไม่สำเร็จ — กด "ลองสร้าง Draft อีกครั้ง" (${msg.slice(0, 100)})`);
      throw new BadRequestException(`สร้าง Draft ไม่สำเร็จ: ${msg}`);
    }
    return this.findDetail(tenantId, request.id);
  }

  async respond(tenantId: number, requesterId: number, id: number, dto: RespondSignRequestDto): Promise<SignDetail> {
    const request = await this.findRequest(tenantId, id);
    if (request.status !== 'need_more_info') {
      throw new BadRequestException('Only Need More Info requests can be updated by branch users');
    }
    await this.saveAssets(tenantId, request.id, dto.assets ?? []);
    request.notes = [request.notes, `Branch response: ${dto.note}`].filter(Boolean).join('\n\n');
    request.requesterId = requesterId;
    await this.requests.save(request);
    await this.transition(request, 'ai_processing', 'สาขาส่งข้อมูลเพิ่มแล้ว ระบบกำลังสร้าง Draft ใหม่');
    await this.processAiAndDraft(request, requesterId);
    await this.notifyMarketing(tenantId, request);
    return this.findDetail(tenantId, request.id);
  }

  async regenerate(tenantId: number, userId: number, id: number): Promise<SignDetail> {
    const request = await this.findRequest(tenantId, id);
    if (!['pending_review', 'need_more_info', 'approved'].includes(request.status)) {
      throw new BadRequestException('Request is not ready for regeneration');
    }
    await this.transition(request, 'ai_processing', 'กำลังสร้าง Draft ใหม่');
    try {
      await this.processAiAndDraft(request, userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.transition(request, 'ai_processing', `สร้าง Draft ไม่สำเร็จ — กด "ลองสร้าง Draft อีกครั้ง" (${msg.slice(0, 100)})`);
      throw new BadRequestException(`สร้าง Draft ไม่สำเร็จ: ${msg}`);
    }
    return this.findDetail(tenantId, id);
  }

  async retryDraft(tenantId: number, userId: number, roles: string[], id: number): Promise<SignDetail> {
    const request = await this.findRequest(tenantId, id);
    this.assertCanMutateRequest(request, userId, roles);
    if (!['submitted', 'ai_processing'].includes(request.status)) {
      throw new BadRequestException('คำขอนี้ไม่ได้ค้างอยู่ในขั้นสร้าง Draft');
    }
    await this.transition(request, 'ai_processing', 'กำลังสร้าง Draft อีกครั้ง...');
    try {
      await this.retryDraftGeneration(request, userId);
      await this.notifyMarketing(tenantId, request);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.transition(request, 'ai_processing', `สร้าง Draft ไม่สำเร็จ — กด "ลองสร้าง Draft อีกครั้ง" (${msg.slice(0, 100)})`);
      throw new BadRequestException(`สร้าง Draft ไม่สำเร็จ: ${msg}`);
    }
    return this.findDetail(tenantId, id);
  }

  async removeRequest(tenantId: number, userId: number, roles: string[], id: number): Promise<{ message: string }> {
    const request = await this.findRequest(tenantId, id);
    this.assertCanMutateRequest(request, userId, roles);
    if (request.status === 'exported') {
      throw new BadRequestException('ไม่สามารถลบคำขอที่ Export แล้ว');
    }

    const [assets, drafts, exports] = await Promise.all([
      this.assets.find({ where: { tenantId, requestId: id } }),
      this.drafts.find({ where: { tenantId, requestId: id } }),
      this.exportsRepo.find({ where: { tenantId, requestId: id } }),
    ]);

    for (const asset of assets) {
      this.unlinkUpload(asset.filename);
    }
    for (const draft of drafts) {
      this.unlinkUpload(path.basename(draft.previewPath));
      const flatUrl = draft.editableFields?._flatPreviewUrl;
      if (typeof flatUrl === 'string') {
        this.unlinkUpload(flatUrl.replace(/^.*\//, ''));
      }
    }
    for (const exp of exports) {
      this.unlinkUpload(exp.filename);
    }

    await this.exportsRepo.delete({ tenantId, requestId: id });
    await this.reviews.delete({ tenantId, requestId: id });
    await this.drafts.delete({ tenantId, requestId: id });
    await this.aiResults.delete({ tenantId, requestId: id });
    await this.assets.delete({ tenantId, requestId: id });
    await this.requests.remove(request);
    return { message: 'ลบคำขอแล้ว' };
  }

  async updateDraft(tenantId: number, userId: number, id: number, dto: UpdateSignDraftDto): Promise<SignDetail> {
    const request = await this.findRequest(tenantId, id);
    const current = await this.drafts.findOne({ where: { tenantId, requestId: id }, order: { version: 'DESC' } });
    const fields = { ...(current?.editableFields ?? {}), ...dto.fields };
    const draft = await this.createDraft(request, userId, fields, (current?.version ?? 0) + 1);
    request.status = 'pending_review';
    request.statusNote = `Draft v${draft.version} ถูกแก้ไขโดย Marketing`;
    await this.requests.save(request);
    return this.findDetail(tenantId, id);
  }

  async review(tenantId: number, reviewerId: number, id: number, dto: ReviewSignRequestDto): Promise<SignDetail> {
    const request = await this.findRequest(tenantId, id);
    if (!['pending_review', 'approved'].includes(request.status)) {
      throw new BadRequestException('Request is not pending review');
    }
    if ((dto.decision === 'reject' || dto.decision === 'need_more_info') && !dto.note?.trim()) {
      throw new BadRequestException('Decision note is required');
    }

    await this.reviews.save(this.reviews.create({
      tenantId,
      requestId: id,
      reviewerId,
      decision: dto.decision,
      note: dto.note?.trim() || null,
      editedFields: dto.editedFields ?? null,
    }));

    request.reviewerId = reviewerId;
    request.status = this.statusForDecision(dto.decision);
    request.statusNote = dto.note?.trim() || null;
    request.approvedAt = dto.decision === 'approve' ? new Date() : request.approvedAt;
    await this.requests.save(request);

    if (dto.decision === 'approve') {
      await this.exportFinal(tenantId, id);
    } else {
      await this.notifyRequester(request, dto.decision === 'reject' ? 'คำขอป้ายถูก Reject' : 'คำขอป้ายต้องการข้อมูลเพิ่ม');
    }
    return this.findDetail(tenantId, id);
  }

  async exportFinal(tenantId: number, id: number): Promise<SignDetail> {
    const request = await this.findRequest(tenantId, id);
    if (!['approved', 'exported'].includes(request.status)) {
      throw new BadRequestException('Only approved sign requests can be exported');
    }
    const draft = await this.drafts.findOne({ where: { tenantId, requestId: id }, order: { version: 'DESC' } });
    if (!draft) throw new BadRequestException('No draft is available to export');

    const existing = await this.exportsRepo.find({ where: { tenantId, requestId: id } });
    if (existing.length === 0) {
      const png = await this.writePng(request, draft.editableFields ?? {}, `sign-${request.requestNo}-final.png`);
      const pdf = await this.writePdf(request, draft.editableFields ?? {}, `sign-${request.requestNo}-print.pdf`);
      await this.saveExportWithDrive(tenantId, id, 'png', png);
      await this.saveExportWithDrive(tenantId, id, 'pdf', pdf);
    }

    request.status = 'exported';
    request.statusNote = 'Export ไฟล์สำเร็จ';
    request.exportedAt = new Date();
    await this.requests.save(request);
    await this.notifyRequester(request, 'ไฟล์ป้ายพร้อมดาวน์โหลดแล้ว');
    return this.findDetail(tenantId, id);
  }

  async serve(filename: string): Promise<{ path: string; mime: string }> {
    const safe = path.basename(filename);
    const filePath = path.join(this.uploadDir, safe);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');
    const mime = safe.endsWith('.pdf') ? 'application/pdf' : safe.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    return { path: filePath, mime };
  }

  private async findRequest(tenantId: number, id: number): Promise<SignRequest> {
    const request = await this.requests.findOne({ where: { tenantId, id } });
    if (!request) throw new NotFoundException('Sign request not found');
    return request;
  }

  private async saveAssets(tenantId: number, requestId: number, inputs: SignAssetInputDto[]): Promise<void> {
    for (const input of inputs.slice(0, 8)) {
      const parsed = this.parseDataUrl(input.dataUrl);
      const ext = parsed.mimeType.includes('jpeg') ? 'jpg' : parsed.mimeType.includes('webp') ? 'webp' : 'png';
      const filename = `sign-${requestId}-${input.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const localPath = path.join(this.uploadDir, filename);
      fs.writeFileSync(localPath, parsed.buffer);
      await this.assets.save(this.assets.create({
        tenantId,
        requestId,
        kind: input.kind,
        originalName: input.originalName ?? null,
        filename,
        url: `/signs/serve/${filename}`,
        mimeType: parsed.mimeType,
      }));
    }
  }

  private async processAiAndDraft(request: SignRequest, userId: number | null): Promise<void> {
    const ai = await this.generateAiResult(request);
    const savedAi = await this.aiResults.save(this.aiResults.create({
      tenantId: request.tenantId,
      requestId: request.id,
      ...ai,
    }));
    const existing = await this.drafts.findOne({ where: { tenantId: request.tenantId, requestId: request.id }, order: { version: 'DESC' } });
    await this.createDraft(request, userId, this.fieldsFromRequest(request, savedAi), (existing?.version ?? 0) + 1);
    await this.transition(request, 'pending_review', 'AI สร้าง Draft แล้ว รอ Marketing ตรวจสอบ');
  }

  private async generateAiResult(request: SignRequest): Promise<Partial<SignAiResult>> {
    const userBenefits = this.parseBenefitsText(request.benefits);
    const fallback = {
      extractedProductName: request.productName,
      extractedPrice: request.price != null ? String(request.price) : null,
      extractedPromotion: request.promotion,
      headline: request.headline ?? this.defaultHeadline(request),
      benefits: userBenefits.length > 0 ? userBenefits : this.defaultBenefits(request),
      rawText: 'AI fallback generated from branch request fields.',
      model: 'fallback',
    };

    if (request.headline && userBenefits.length > 0) {
      return { ...fallback, model: 'user_provided' };
    }

    try {
      const result = await this.openai.complete(
        'You are an AI sign designer for a Thai retail chain. Return compact JSON only.',
        [
          `Create data for a retail sign request.`,
          `Product: ${request.productName}`,
          `SKU: ${request.sku ?? '-'}`,
          `Price: ${request.price ?? '-'}`,
          `Promotion: ${request.promotion ?? '-'}`,
          `Sign type: ${SIGN_TYPE_LABELS[request.signType]}`,
          `Size: ${SIGN_SIZE_LABELS[request.signSize]}`,
          `Notes: ${request.notes ?? '-'}`,
          request.headline ? `Preferred headline (use exactly): ${request.headline}` : '',
          userBenefits.length > 0 ? `Preferred benefits (use these): ${userBenefits.join('; ')}` : '',
          'Return JSON with extractedProductName, extractedPrice, extractedPromotion, headline, benefits array, rawText.',
        ].filter(Boolean).join('\n'),
      );
      const parsed = this.parseJsonObject(result.content);
      return {
        extractedProductName: this.asString(parsed.extractedProductName) || fallback.extractedProductName,
        extractedPrice: this.asString(parsed.extractedPrice) || fallback.extractedPrice,
        extractedPromotion: this.asString(parsed.extractedPromotion) || fallback.extractedPromotion,
        headline: request.headline || this.asString(parsed.headline) || fallback.headline,
        benefits: userBenefits.length > 0
          ? userBenefits
          : Array.isArray(parsed.benefits) ? parsed.benefits.map(String).slice(0, 4) : fallback.benefits,
        rawText: this.asString(parsed.rawText) || result.content,
        model: result.model,
      };
    } catch (err) {
      this.logger.warn(`AI sign extraction failed: ${err instanceof Error ? err.message : String(err)}`);
      return fallback;
    }
  }

  private async createDraft(
    request: SignRequest,
    userId: number | null,
    fields: Record<string, unknown>,
    version: number,
  ): Promise<SignDraft> {
    const flatFilename = `sign-${request.requestNo}-draft-v${version}-flat.png`;
    const mockupFilename = `sign-${request.requestNo}-draft-v${version}.png`;
    const flat = await this.writePng(request, fields, flatFilename);
    const mockupPath = path.join(this.uploadDir, mockupFilename);
    await composeShelfMockup(flat.localPath, request.signSize, mockupPath);
    return this.drafts.save(this.drafts.create({
      tenantId: request.tenantId,
      requestId: request.id,
      version,
      templateId: this.templateFor(request),
      previewUrl: `/signs/serve/${mockupFilename}`,
      previewPath: mockupPath,
      editableFields: { ...fields, _flatPreviewUrl: flat.url },
      createdBy: userId,
    }));
  }

  private async writePng(
    request: SignRequest,
    fields: Record<string, unknown>,
    filename: string,
  ): Promise<{ filename: string; url: string; localPath: string }> {
    const localPath = path.join(this.uploadDir, filename);

    // Look for uploaded template — prefer explicit choice, then type+size match
    let uploadedTpl: SignTemplate | null = null;
    try {
      if (request.templateId) {
        uploadedTpl = await this.templates.findOne({
          where: { id: request.templateId, tenantId: request.tenantId, isActive: true },
        });
      }
      if (!uploadedTpl) {
        uploadedTpl = await this.templates.findOne({
          where: [
            { tenantId: request.tenantId, signType: request.signType, signSize: request.signSize, isActive: true },
            { tenantId: request.tenantId, signType: request.signType, signSize: IsNull(), isActive: true },
            { tenantId: request.tenantId, signType: IsNull(), signSize: request.signSize, isActive: true },
          ],
          order: { createdAt: 'DESC' },
        });
      }
    } catch (err) {
      this.logger.warn(`Template lookup skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (uploadedTpl) {
      const tplPath = path.join(this.uploadDir, uploadedTpl.filename);
      if (fs.existsSync(tplPath)) {
        const baseImg = sharp(tplPath);
        const meta = await baseImg.metadata();
        const w = meta.width ?? 1200;
        const h = meta.height ?? 1400;
        const overlay = Buffer.from(this.renderTextOverlay(request, fields, w, h));
        await sharp(tplPath)
          .composite([{ input: overlay, blend: 'over' }])
          .png()
          .toFile(localPath);
        return { filename, url: `/signs/serve/${filename}`, localPath };
      }
    }

    // Fall back to built-in SVG template
    const svg = this.renderSvg(request, fields);
    await sharp(Buffer.from(svg)).png().toFile(localPath);
    return { filename, url: `/signs/serve/${filename}`, localPath };
  }

  private async writePdf(
    request: SignRequest,
    fields: Record<string, unknown>,
    filename: string,
  ): Promise<{ filename: string; url: string; localPath: string }> {
    const localPath = path.join(this.uploadDir, filename);
    fs.writeFileSync(localPath, this.renderSimplePdf(request, fields));
    return { filename, url: `/signs/serve/${filename}`, localPath };
  }

  private async saveExportWithDrive(
    tenantId: number,
    requestId: number,
    format: 'png' | 'pdf',
    file: { filename: string; url: string; localPath: string },
  ): Promise<void> {
    const record = this.exportsRepo.create({
      tenantId,
      requestId,
      format,
      filename: file.filename,
      url: file.url,
      localPath: file.localPath,
      driveFileId: null,
      driveUrl: null,
      status: 'ready',
      error: null,
    });
    try {
      const driveResult = await this.drive.uploadFile(file.localPath, format === 'pdf' ? 'application/pdf' : 'image/png');
      record.driveFileId = driveResult.fileId;
      record.driveUrl = driveResult.webViewLink;
    } catch (err) {
      record.status = 'drive_failed';
      record.error = err instanceof Error ? err.message : String(err);
    }
    await this.exportsRepo.save(record);
  }

  private async transition(request: SignRequest, status: SignRequestStatus, note: string | null): Promise<void> {
    request.status = status;
    request.statusNote = note;
    await this.requests.save(request);
  }

  private statusForDecision(decision: SignReviewDecision): SignRequestStatus {
    if (decision === 'approve') return 'approved';
    if (decision === 'reject') return 'rejected';
    return 'need_more_info';
  }

  private async notifyMarketing(tenantId: number, request: SignRequest): Promise<void> {
    await this.notifications.create({
      tenantId,
      type: 'ai',
      title: 'AI Sign รอตรวจอนุมัติ',
      body: `${request.requestNo} • ${request.productName} จาก ${request.branchName}`,
    }).catch(() => undefined);
  }

  private async notifyRequester(request: SignRequest, title: string): Promise<void> {
    await this.notifications.create({
      tenantId: request.tenantId,
      userId: request.requesterId,
      type: 'ai',
      title,
      body: `${request.requestNo} • ${request.productName}`,
    }).catch(() => undefined);
  }

  private fieldsFromRequest(request: SignRequest, ai: SignAiResult): Record<string, unknown> {
    const userBenefits = this.parseBenefitsText(request.benefits);
    return {
      headline: request.headline ?? ai.headline ?? this.defaultHeadline(request),
      productName: ai.extractedProductName ?? request.productName,
      price: request.price != null ? `฿${Number(request.price).toFixed(0)}` : ai.extractedPrice ?? '',
      promotion: ai.extractedPromotion ?? request.promotion ?? '',
      benefits: userBenefits.length > 0 ? userBenefits : ai.benefits ?? this.defaultBenefits(request),
      branchName: request.branchName,
      signTypeLabel: SIGN_TYPE_LABELS[request.signType],
      signSizeLabel: SIGN_SIZE_LABELS[request.signSize],
    };
  }

  private templateFor(request: SignRequest): string {
    return request.templateId ? `tpl_${request.templateId}` : `${request.signType}_${request.signSize}`;
  }

  private parseBenefitsText(raw: string | null | undefined): string[] {
    if (!raw?.trim()) return [];
    return raw.split(/\n|,|•/).map((v) => v.trim()).filter(Boolean).slice(0, 4);
  }

  private defaultHeadline(request: SignRequest): string {
    if (request.signType === 'promotion') return request.promotion || 'โปรพิเศษวันนี้';
    if (request.signType === 'benefit_card') return 'จุดเด่นสินค้า';
    if (request.signType === 'shelf_tag') return 'สินค้าน่าซื้อ';
    return 'ราคาพิเศษ';
  }

  private defaultBenefits(request: SignRequest): string[] {
    const base = request.notes?.split(/\n|,|•/).map((v) => v.trim()).filter(Boolean).slice(0, 3) ?? [];
    return base.length > 0 ? base : ['เหมาะสำหรับหน้าร้าน', 'อ่านง่าย สะดุดตา', 'พร้อมใช้งานทันที'];
  }

  private signCanvas(signSize: string): { w: number; h: number } {
    const map: Record<string, { w: number; h: number }> = {
      a5: { w: 1240, h: 1754 },
      a6: { w: 1240, h: 1400 },
      a7: { w: 993, h: 1240 },
      shelf_tag: { w: 1240, h: 590 },
    };
    return map[signSize] ?? { w: 1240, h: 1400 };
  }

  private renderSvg(request: SignRequest, fields: Record<string, unknown>): string {
    const { w, h } = this.signCanvas(request.signSize);
    const headline = this.escape(String(fields.headline ?? this.defaultHeadline(request)));
    const product = this.escape(String(fields.productName ?? request.productName));
    const price = this.escape(String(fields.price ?? (request.price != null ? `฿${request.price}` : '')));
    const promo = this.escape(String(fields.promotion ?? request.promotion ?? ''));
    const benefits = Array.isArray(fields.benefits) ? fields.benefits.map((v) => this.escape(String(v))).slice(0, 3) : [];
    const branchLine = this.escape(`${request.branchName} • ${SIGN_TYPE_LABELS[request.signType]} ${SIGN_SIZE_LABELS[request.signSize]}`);

    if (request.signType === 'price_tag') return this.svgPriceTag(w, h, { headline, product, price, promo, branchLine });
    if (request.signType === 'promotion') return this.svgPromotion(w, h, { headline, product, price, promo, branchLine });
    if (request.signType === 'benefit_card') return this.svgBenefitCard(w, h, { headline, product, price, benefits, branchLine });
    if (request.signSize === 'shelf_tag') return this.svgShelfTag(w, h, { headline, product, price, branchLine });
    return this.svgDefault(w, h, { headline, product, price, promo, benefits, branchLine });
  }

  private svgPriceTag(w: number, h: number, f: { headline: string; product: string; price: string; promo: string; branchLine: string }): string {
    const cx = w / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#991b1b"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#fef9f0"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <!-- decorative circles -->
  <circle cx="${w}" cy="0" r="${w * 0.55}" fill="#ffffff" opacity="0.04"/>
  <circle cx="0" cy="${h}" r="${w * 0.45}" fill="#f59e0b" opacity="0.07"/>
  <!-- header band -->
  <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.14)}" fill="#b91c1c"/>
  <text x="${cx}" y="${Math.round(h * 0.09)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.042)}" font-weight="900" fill="#fef2f2" letter-spacing="6">100 BAHT SHOP</text>
  <text x="${cx}" y="${Math.round(h * 0.126)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.022)}" font-weight="700" fill="#fecaca" letter-spacing="2">${f.headline}</text>
  <!-- white card -->
  <rect x="60" y="${Math.round(h * 0.17)}" width="${w - 120}" height="${Math.round(h * 0.54)}" rx="32" fill="url(#card)" stroke="#e5e7eb" stroke-width="2"/>
  <!-- product name -->
  <text x="${cx}" y="${Math.round(h * 0.28)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.038)}" font-weight="800" fill="#111827">${f.product}</text>
  <!-- price starburst -->
  <circle cx="${cx}" cy="${Math.round(h * 0.47)}" r="${Math.round(h * 0.16)}" fill="#dc2626"/>
  <circle cx="${cx}" cy="${Math.round(h * 0.47)}" r="${Math.round(h * 0.155)}" fill="none" stroke="#fca5a5" stroke-width="4" stroke-dasharray="14 8"/>
  <text x="${cx}" y="${Math.round(h * 0.455)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.024)}" font-weight="900" fill="#fef2f2">ราคา</text>
  <text x="${cx}" y="${Math.round(h * 0.505)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.092)}" font-weight="900" fill="#ffffff">${f.price}</text>
  <!-- promo badge -->
  ${f.promo ? `<rect x="${cx - 280}" y="${Math.round(h * 0.635)}" width="560" height="${Math.round(h * 0.055)}" rx="24" fill="#fef3c7"/>
  <text x="${cx}" y="${Math.round(h * 0.674)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.03)}" font-weight="700" fill="#92400e">${f.promo}</text>` : ''}
  <!-- footer -->
  <text x="${cx}" y="${Math.round(h * 0.965)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.018)}" fill="#94a3b8">${f.branchLine}</text>
</svg>`;
  }

  private svgPromotion(w: number, h: number, f: { headline: string; product: string; price: string; promo: string; branchLine: string }): string {
    const cx = w / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="gbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14532d"/>
      <stop offset="100%" stop-color="#166534"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#gbg)"/>
  <circle cx="${w * 0.85}" cy="${h * 0.12}" r="${h * 0.2}" fill="#f59e0b" opacity="0.18"/>
  <circle cx="${w * 0.1}" cy="${h * 0.85}" r="${h * 0.18}" fill="#22c55e" opacity="0.12"/>
  <!-- top ribbon -->
  <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.12)}" fill="#15803d"/>
  <text x="${cx}" y="${Math.round(h * 0.075)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.044)}" font-weight="900" fill="#fef9c3" letter-spacing="5">100 BAHT SHOP</text>
  <!-- headline burst -->
  <rect x="40" y="${Math.round(h * 0.14)}" width="${w - 80}" height="${Math.round(h * 0.16)}" rx="28" fill="#f59e0b"/>
  <text x="${cx}" y="${Math.round(h * 0.20)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.052)}" font-weight="900" fill="#1c1917">${f.headline}</text>
  <text x="${cx}" y="${Math.round(h * 0.255)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.025)}" font-weight="700" fill="#292524">${f.promo}</text>
  <!-- product white card -->
  <rect x="60" y="${Math.round(h * 0.33)}" width="${w - 120}" height="${Math.round(h * 0.28)}" rx="28" fill="#ffffff" fill-opacity="0.97"/>
  <text x="${cx}" y="${Math.round(h * 0.4)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.032)}" font-weight="700" fill="#374151">${f.product}</text>
  <text x="${cx}" y="${Math.round(h * 0.52)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.1)}" font-weight="900" fill="#dc2626">${f.price}</text>
  <!-- badge -->
  <rect x="${cx - 200}" y="${Math.round(h * 0.64)}" width="400" height="${Math.round(h * 0.07)}" rx="24" fill="#dcfce7"/>
  <text x="${cx}" y="${Math.round(h * 0.687)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.033)}" font-weight="700" fill="#166534">✓ โปรโมชั่นพิเศษ</text>
  <text x="${cx}" y="${Math.round(h * 0.965)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.018)}" fill="#86efac">${f.branchLine}</text>
</svg>`;
  }

  private svgBenefitCard(w: number, h: number, f: { headline: string; product: string; price: string; benefits: string[]; branchLine: string }): string {
    const cx = w / 2;
    const benefitItems = f.benefits.map((b, i) =>
      `<g>
        <circle cx="82" cy="${Math.round(h * 0.51) + i * Math.round(h * 0.1)}" r="18" fill="#6366f1"/>
        <text x="82" y="${Math.round(h * 0.517) + i * Math.round(h * 0.1)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#fff">${i + 1}</text>
        <text x="116" y="${Math.round(h * 0.517) + i * Math.round(h * 0.1)}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.028)}" font-weight="600" fill="#1e1b4b">${b}</text>
      </g>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4338ca"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#f8fafc"/>
  <!-- left accent bar -->
  <rect x="0" y="0" width="18" height="${h}" fill="url(#hdr)"/>
  <!-- header -->
  <rect x="18" y="0" width="${w - 18}" height="${Math.round(h * 0.22)}" fill="url(#hdr)"/>
  <text x="${cx + 9}" y="${Math.round(h * 0.1)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.042)}" font-weight="900" fill="#ffffff" letter-spacing="4">100 BAHT SHOP</text>
  <text x="${cx + 9}" y="${Math.round(h * 0.17)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.034)}" font-weight="700" fill="#c7d2fe">${f.product}</text>
  <!-- headline badge -->
  <rect x="60" y="${Math.round(h * 0.24)}" width="${w - 120}" height="${Math.round(h * 0.08)}" rx="24" fill="#ede9fe"/>
  <text x="${cx}" y="${Math.round(h * 0.293)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.036)}" font-weight="700" fill="#5b21b6">${f.headline}</text>
  <!-- price row -->
  <text x="${cx}" y="${Math.round(h * 0.42)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.082)}" font-weight="900" fill="#dc2626">${f.price}</text>
  <!-- benefits section -->
  <text x="60" y="${Math.round(h * 0.49)}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.023)}" font-weight="700" fill="#6366f1" letter-spacing="2">จุดเด่น</text>
  ${benefitItems}
  <!-- footer -->
  <text x="${cx}" y="${Math.round(h * 0.965)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.018)}" fill="#94a3b8">${f.branchLine}</text>
</svg>`;
  }

  private svgShelfTag(w: number, h: number, f: { headline: string; product: string; price: string; branchLine: string }): string {
    const priceX = Math.round(w * 0.74);
    const mid = Math.round(h / 2);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>
  <!-- left block -->
  <rect x="0" y="0" width="${Math.round(w * 0.62)}" height="${h}" rx="20" fill="url(#sl)"/>
  <rect x="${Math.round(w * 0.52)}" y="0" width="${Math.round(w * 0.12)}" height="${h}" fill="url(#sl)"/>
  <!-- brand -->
  <text x="${Math.round(w * 0.04)}" y="${Math.round(h * 0.38)}" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.19)}" font-weight="900" fill="#93c5fd" opacity="0.6" letter-spacing="1">100</text>
  <!-- product name -->
  <text x="${Math.round(w * 0.05)}" y="${Math.round(h * 0.52)}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.18)}" font-weight="800" fill="#ffffff">${f.product.slice(0, 22)}</text>
  <text x="${Math.round(w * 0.05)}" y="${Math.round(h * 0.78)}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.13)}" font-weight="600" fill="#bfdbfe">${f.headline}</text>
  <!-- price circle -->
  <circle cx="${priceX}" cy="${mid}" r="${Math.round(h * 0.44)}" fill="#dc2626"/>
  <circle cx="${priceX}" cy="${mid}" r="${Math.round(h * 0.42)}" fill="none" stroke="#fca5a5" stroke-width="3" stroke-dasharray="10 6"/>
  <text x="${priceX}" y="${mid - Math.round(h * 0.07)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.12)}" fill="#fef2f2">ราคา</text>
  <text x="${priceX}" y="${mid + Math.round(h * 0.22)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.3)}" font-weight="900" fill="#ffffff">${f.price}</text>
</svg>`;
  }

  private svgDefault(w: number, h: number, f: { headline: string; product: string; price: string; promo: string; benefits: string[]; branchLine: string }): string {
    const cx = w / 2;
    const benefitText = f.benefits.map((b, i) =>
      `<text x="80" y="${Math.round(h * 0.68) + i * Math.round(h * 0.075)}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.028)}" fill="#1f2937">• ${b}</text>`
    ).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.22)}" fill="#dc2626"/>
  <circle cx="${w - 100}" cy="96" r="54" fill="#ffffff" opacity="0.12"/>
  <text x="64" y="${Math.round(h * 0.09)}" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.038)}" font-weight="900" fill="#ffffff" letter-spacing="4">100 BAHT SHOP</text>
  <text x="64" y="${Math.round(h * 0.155)}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.026)}" font-weight="700" fill="#fecaca">${f.headline}</text>
  <rect x="58" y="${Math.round(h * 0.25)}" width="${w - 116}" height="${Math.round(h * 0.3)}" rx="28" fill="#fef9f0" stroke="#f97316" stroke-width="4"/>
  <text x="${cx}" y="${Math.round(h * 0.34)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.04)}" font-weight="800" fill="#111827">${f.product}</text>
  <text x="${cx}" y="${Math.round(h * 0.495)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.1)}" font-weight="900" fill="#dc2626">${f.price}</text>
  <text x="${cx}" y="${Math.round(h * 0.595)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.031)}" font-weight="700" fill="#b45309">${f.promo}</text>
  ${benefitText}
  <text x="${cx}" y="${Math.round(h * 0.965)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.018)}" fill="#94a3b8">${f.branchLine}</text>
</svg>`;
  }

  /** SVG overlay for uploaded template: transparent bg + text only */
  private renderTextOverlay(request: SignRequest, fields: Record<string, unknown>, w: number, h: number): string {
    const cx = w / 2;
    const headline = this.escape(String(fields.headline ?? this.defaultHeadline(request)));
    const product = this.escape(String(fields.productName ?? request.productName));
    const price = this.escape(String(fields.price ?? (request.price != null ? `฿${request.price}` : '')));
    const promo = this.escape(String(fields.promotion ?? request.promotion ?? ''));
    const benefits = Array.isArray(fields.benefits) ? fields.benefits.map((v) => this.escape(String(v))).slice(0, 3) : [];
    const benefitText = benefits.map((b, i) =>
      `<text x="${Math.round(w * 0.08)}" y="${Math.round(h * 0.7) + i * Math.round(h * 0.07)}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.028)}" fill="#1f2937">• ${b}</text>`
    ).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${cx}" y="${Math.round(h * 0.12)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.05)}" font-weight="900" fill="#ffffff" stroke="#000000" stroke-width="2">${product}</text>
  <text x="${cx}" y="${Math.round(h * 0.32)}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(h * 0.13)}" font-weight="900" fill="#dc2626" stroke="#1a0000" stroke-width="3">${price}</text>
  <text x="${cx}" y="${Math.round(h * 0.47)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.038)}" font-weight="700" fill="#1e1b4b">${headline}</text>
  ${promo ? `<text x="${cx}" y="${Math.round(h * 0.58)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.03)}" font-weight="600" fill="#92400e">${promo}</text>` : ''}
  ${benefitText}
</svg>`;
  }

  private renderSimplePdf(request: SignRequest, fields: Record<string, unknown>): Buffer {
    const lines = [
      'AI Sign Generator',
      `Request: ${request.requestNo}`,
      `Branch: ${request.branchName}`,
      `Product: ${String(fields.productName ?? request.productName)}`,
      `Headline: ${String(fields.headline ?? this.defaultHeadline(request))}`,
      `Price: ${String(fields.price ?? request.price ?? '')}`,
      `Promotion: ${String(fields.promotion ?? request.promotion ?? '')}`,
      `Type: ${SIGN_TYPE_LABELS[request.signType]} / ${SIGN_SIZE_LABELS[request.signSize]}`,
    ].map((line) => line.replace(/[^\x20-\x7E]/g, ''));
    const content = [
      'BT',
      '/F1 18 Tf',
      '50 760 Td',
      ...lines.flatMap((line, index) => [
        index === 0 ? '' : '0 -34 Td',
        `(${this.escapePdf(line)}) Tj`,
      ]),
      'ET',
    ].filter(Boolean).join('\n');
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${obj}\n`;
    }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
  }

  private parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
    const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
    if (!match) throw new BadRequestException('Invalid image data URL');
    return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
  }

  private parseJsonObject(content: string): Record<string, unknown> {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return JSON.parse(cleaned) as Record<string, unknown>;
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async lookupCatalogProduct(rawSku: string): Promise<{
    sku: string;
    name: string;
    retailPrice: number;
    imageUrl: string;
    promotionText: string | null;
    promotions: Array<{ id: number; name: string; typeName?: string; promoPrice: number; conditions: string }>;
  } | null> {
    const sku = rawSku.replace(/\s+/g, '').toUpperCase();
    const [product, promo] = await Promise.all([
      this.productCache.findOne({ where: { sku } }),
      this.promoCache.findOne({ where: { sku } }),
    ]);
    if (!product) return null;
    const promotions = (promo?.promotions ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      typeName: p.typeName,
      promoPrice: Number(p.promoPrice ?? 0),
      conditions: p.conditions ?? '',
    }));
    return {
      sku: product.sku,
      name: product.name,
      retailPrice: Number(product.retailPrice ?? 0),
      imageUrl: product.imageUrl ?? '',
      promotionText: this.buildPromotionText(promotions, promo?.promotionNames ?? null),
      promotions,
    };
  }

  private buildPromotionText(
    promotions: Array<{ name: string; typeName?: string; promoPrice: number; conditions: string }>,
    promotionNames: string | null,
  ): string | null {
    if (promotions.length > 0) {
      return promotions
        .slice(0, 3)
        .map((p) => `${p.name} ฿${Math.round(p.promoPrice)}${p.conditions ? ` (${p.conditions})` : ''}`)
        .join(' · ');
    }
    return promotionNames?.trim() || null;
  }

  private async catalogImageAsAsset(imageUrl: string, sku: string): Promise<SignAssetInputDto | null> {
    if (!imageUrl?.trim()) return null;
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
      if (!mimeType.startsWith('image/')) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 32) return null;
      return {
        kind: 'product',
        dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
        originalName: `${sku}-catalog.jpg`,
      };
    } catch (err) {
      this.logger.warn(`Catalog image fetch failed for ${sku}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async retryDraftGeneration(request: SignRequest, userId: number | null): Promise<void> {
    const existingAi = await this.aiResults.findOne({
      where: { tenantId: request.tenantId, requestId: request.id },
      order: { createdAt: 'DESC' },
    });
    if (existingAi) {
      const existingDraft = await this.drafts.findOne({
        where: { tenantId: request.tenantId, requestId: request.id },
        order: { version: 'DESC' },
      });
      await this.createDraft(
        request,
        userId,
        this.fieldsFromRequest(request, existingAi),
        (existingDraft?.version ?? 0) + 1,
      );
      await this.transition(request, 'pending_review', 'AI สร้าง Draft แล้ว รอ Marketing ตรวจสอบ');
      return;
    }
    await this.processAiAndDraft(request, userId);
  }

  private assertCanMutateRequest(request: SignRequest, userId: number, roles: string[]): void {
    const isMarketing = roles.some((role) =>
      ['super_admin', 'admin', 'marketing_manager', 'marketing_staff'].includes(role),
    );
    if (isMarketing) return;
    if (request.requesterId === userId) return;
    throw new ForbiddenException('ไม่มีสิทธิ์จัดการคำขอนี้');
  }

  private unlinkUpload(filename: string): void {
    if (!filename) return;
    const safe = path.basename(filename);
    const localPath = path.join(this.uploadDir, safe);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  }

  private makeRequestNo(): string {
    const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `SIGN-${stamp}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapePdf(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}
