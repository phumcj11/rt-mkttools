import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
} from '../../database/entities';
import { OpenAiService } from '../ai/openai.service';
import { DriveService } from '../media/drive.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSignRequestDto, SignAssetInputDto } from './dto/create-sign-request.dto';
import { RespondSignRequestDto } from './dto/respond-sign-request.dto';
import { ReviewSignRequestDto } from './dto/review-sign-request.dto';
import { UpdateSignDraftDto } from './dto/update-sign-draft.dto';

const SIGN_TYPE_LABELS: Record<string, string> = {
  price_tag: 'ป้ายราคา',
  promotion: 'ป้ายโปรโมชั่น',
  benefit_card: 'ป้ายสรรพคุณ',
  shelf_tag: 'Shelf Tag',
};

const SIGN_SIZE_LABELS: Record<string, string> = {
  a5: 'A5',
  a6: 'A6',
  a7: 'A7',
  shelf_tag: 'Shelf Tag',
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
    private readonly openai: OpenAiService,
    private readonly notifications: NotificationsService,
    private readonly drive: DriveService,
  ) {
    fs.mkdirSync(this.uploadDir, { recursive: true });
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
    const request = await this.requests.save(this.requests.create({
      tenantId,
      requesterId,
      reviewerId: null,
      requestNo: this.makeRequestNo(),
      branchName: dto.branchName.trim(),
      requesterName: dto.requesterName.trim(),
      sku: dto.sku?.trim() || null,
      productName: dto.productName.trim(),
      price: dto.price ?? null,
      promotion: dto.promotion?.trim() || null,
      signType: dto.signType,
      signSize: dto.signSize,
      notes: dto.notes?.trim() || null,
      status: 'submitted',
      statusNote: null,
      approvedAt: null,
      exportedAt: null,
    }));

    await this.saveAssets(tenantId, request.id, dto.assets ?? []);
    await this.transition(request, 'ai_processing', 'AI กำลังอ่านข้อมูลและสร้าง Draft');
    await this.processAiAndDraft(request, requesterId);
    await this.notifyMarketing(tenantId, request);
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
    await this.processAiAndDraft(request, userId);
    return this.findDetail(tenantId, id);
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
    const fallback = {
      extractedProductName: request.productName,
      extractedPrice: request.price != null ? String(request.price) : null,
      extractedPromotion: request.promotion,
      headline: this.defaultHeadline(request),
      benefits: this.defaultBenefits(request),
      rawText: 'AI fallback generated from branch request fields.',
      model: 'fallback',
    };

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
          'Return JSON with extractedProductName, extractedPrice, extractedPromotion, headline, benefits array, rawText.',
        ].join('\n'),
      );
      const parsed = this.parseJsonObject(result.content);
      return {
        extractedProductName: this.asString(parsed.extractedProductName) || fallback.extractedProductName,
        extractedPrice: this.asString(parsed.extractedPrice) || fallback.extractedPrice,
        extractedPromotion: this.asString(parsed.extractedPromotion) || fallback.extractedPromotion,
        headline: this.asString(parsed.headline) || fallback.headline,
        benefits: Array.isArray(parsed.benefits) ? parsed.benefits.map(String).slice(0, 4) : fallback.benefits,
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
    const filename = `sign-${request.requestNo}-draft-v${version}.png`;
    const rendered = await this.writePng(request, fields, filename);
    return this.drafts.save(this.drafts.create({
      tenantId: request.tenantId,
      requestId: request.id,
      version,
      templateId: this.templateFor(request),
      previewUrl: rendered.url,
      previewPath: rendered.localPath,
      editableFields: fields,
      createdBy: userId,
    }));
  }

  private async writePng(
    request: SignRequest,
    fields: Record<string, unknown>,
    filename: string,
  ): Promise<{ filename: string; url: string; localPath: string }> {
    const localPath = path.join(this.uploadDir, filename);
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
    return {
      headline: ai.headline ?? this.defaultHeadline(request),
      productName: ai.extractedProductName ?? request.productName,
      price: request.price != null ? `฿${Number(request.price).toFixed(0)}` : ai.extractedPrice ?? '',
      promotion: ai.extractedPromotion ?? request.promotion ?? '',
      benefits: ai.benefits ?? this.defaultBenefits(request),
      branchName: request.branchName,
      signTypeLabel: SIGN_TYPE_LABELS[request.signType],
      signSizeLabel: SIGN_SIZE_LABELS[request.signSize],
    };
  }

  private templateFor(request: SignRequest): string {
    return `${request.signType}_${request.signSize}`;
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

  private renderSvg(request: SignRequest, fields: Record<string, unknown>): string {
    const width = request.signSize === 'shelf_tag' ? 1000 : request.signSize === 'a7' ? 900 : 1200;
    const height = request.signSize === 'shelf_tag' ? 625 : request.signSize === 'a5' ? 1690 : request.signSize === 'a6' ? 1400 : 1280;
    const headline = this.escape(String(fields.headline ?? this.defaultHeadline(request)));
    const product = this.escape(String(fields.productName ?? request.productName));
    const price = this.escape(String(fields.price ?? (request.price != null ? `฿${request.price}` : '')));
    const promo = this.escape(String(fields.promotion ?? request.promotion ?? ''));
    const benefits = Array.isArray(fields.benefits) ? fields.benefits.map((v) => this.escape(String(v))).slice(0, 3) : [];
    const isShelf = request.signSize === 'shelf_tag';
    const priceSize = isShelf ? 150 : 210;
    const productSize = isShelf ? 52 : 76;
    const headlineSize = isShelf ? 48 : 72;
    const benefitY = isShelf ? 500 : height - 310;
    const benefitText = benefits.map((b, i) => `<text x="90" y="${benefitY + i * 58}" font-size="${isShelf ? 34 : 42}" fill="#1f2937">• ${b}</text>`).join('');

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="42" fill="#ffffff"/>
  <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.22)}" fill="#dc2626"/>
  <circle cx="${width - 120}" cy="105" r="62" fill="#ffffff" opacity="0.18"/>
  <text x="64" y="96" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="#ffffff">100 BAHT SHOP</text>
  <text x="64" y="154" font-family="Arial, sans-serif" font-size="${headlineSize}" font-weight="900" fill="#fff7ed">${headline}</text>
  <rect x="58" y="${Math.round(height * 0.26)}" width="${width - 116}" height="${isShelf ? 250 : 420}" rx="36" fill="#fff7ed" stroke="#f97316" stroke-width="6"/>
  <text x="${width / 2}" y="${Math.round(height * 0.34)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${productSize}" font-weight="900" fill="#111827">${product}</text>
  <text x="${width / 2}" y="${Math.round(height * 0.48)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${priceSize}" font-weight="900" fill="#dc2626">${price}</text>
  <text x="${width / 2}" y="${Math.round(height * 0.58)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${isShelf ? 42 : 58}" font-weight="800" fill="#b45309">${promo}</text>
  <rect x="58" y="${benefitY - 65}" width="${width - 116}" height="${isShelf ? 150 : 250}" rx="30" fill="#f8fafc" stroke="#e5e7eb"/>
  ${benefitText}
  <text x="64" y="${height - 54}" font-family="Arial, sans-serif" font-size="30" fill="#6b7280">${this.escape(SIGN_TYPE_LABELS[request.signType])} • ${this.escape(SIGN_SIZE_LABELS[request.signSize])} • ${this.escape(request.branchName)}</text>
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
