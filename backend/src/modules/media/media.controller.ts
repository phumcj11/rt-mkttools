import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { DriveService } from './drive.service';
import { MediaService } from './media.service';
import { VideoService } from './video.service';
import { VideoProviderId } from './video.types';

class BatchImageDto {
  @IsArray()
  @IsString({ each: true })
  skus: string[];
}

class SavePromoDto {
  @IsString()
  @IsNotEmpty()
  promoType: string;

  @IsString()
  @IsNotEmpty()
  dataUrl: string;
}

class GeneratePromoGptDto {
  @IsString()
  @IsNotEmpty()
  promoType: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsOptional()
  @IsString()
  referenceImageUrl?: string;
}

class GeneratePromoCompositeDto {
  @IsString()
  @IsNotEmpty()
  promoType: string;

  @IsObject()
  data: Record<string, string>;

  @IsObject()
  imageUrls: Record<string, string>;
}

class VideoSubmitDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsOptional()
  @IsString()
  provider?: VideoProviderId;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  script?: string;

  @IsOptional()
  @IsString()
  visualBrief?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mascotAssetFilenames?: string[];

  @IsOptional()
  @IsBoolean()
  useCutoutProductImage?: boolean;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  @IsIn(['720p', '480p'])
  resolution?: '720p' | '480p';
}

class GeneratePopStickersDto {
  @IsOptional()
  @IsBoolean()
  includeBranded?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandAssetFilenames?: string[];

  @IsOptional()
  @IsNumber()
  brandedCount?: number;
}

class UploadBrandAssetDto {
  @IsString()
  @IsIn(['logo', 'mascot'])
  kind: 'logo' | 'mascot';

  @IsString()
  @IsNotEmpty()
  dataUrl: string;
}

class PollVideoDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsOptional()
  @IsString()
  taskType?: 'image2video' | 'text2video';

  @IsOptional()
  @IsString()
  provider?: VideoProviderId;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@Controller('media')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly drive: DriveService,
    private readonly video: VideoService,
  ) {}

  /** List ERP products available for media generation */
  @Get('products')
  listProducts(@Query('limit') limit?: number, @Query('offset') offset?: number) {
    return this.media.listProducts(limit ?? 50, offset ?? 0);
  }

  /** Generate benefit copy only (for template layouts) */
  @Post('products/:sku/image')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  generateImage(@Param('sku') sku: string) {
    return this.media.generateBenefitImage(sku);
  }

  /** Generate full poster via GPT Image (images.edit / images.generate) */
  @Post('products/:sku/gpt-image')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  generateGptImage(@Param('sku') sku: string) {
    return this.media.generateGptBenefitImage(sku);
  }

  /**
   * AI Product POP Sticker Generator:
   * analyzes ERP image → generates safe copy → produces 4 GPT Image shelf sticker variations
   */
  @Post('products/:sku/pop-stickers')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  generatePopStickers(@Param('sku') sku: string, @Body() dto: GeneratePopStickersDto = {}) {
    return this.media.generatePopStickers(sku, dto);
  }

  /** List uploaded logo/mascot assets for branded POP stickers */
  @Get('brand-assets')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  listBrandAssets() {
    return this.media.listBrandAssets();
  }

  /** Upload reusable logo/mascot asset as data URL */
  @Post('brand-assets/upload')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  uploadBrandAsset(@Body() dto: UploadBrandAssetDto) {
    return this.media.saveBrandAsset(dto.kind, dto.dataUrl);
  }

  /** Serve uploaded brand asset (public — img tags cannot send JWT) */
  @Public()
  @Get('brand-assets/:filename')
  serveBrandAsset(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.media.getBrandAssetPath(filename);
    const safe = path.basename(filename);
    const mime = safe.endsWith('.webp') ? 'image/webp' : safe.endsWith('.jpg') || safe.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
    res.setHeader('Content-Type', mime);
    res.sendFile(filePath);
  }

  /** Save client-rendered benefit poster PNG */
  @Post('products/:sku/poster')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  savePoster(@Param('sku') sku: string, @Body() body: { dataUrl: string }) {
    return this.media.savePosterImage(sku, body.dataUrl);
  }

  /** Generate promotion poster via sharp composite (default — pixel-perfect) */
  @Post('promo/generate')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  generatePromoComposite(@Body() dto: GeneratePromoCompositeDto) {
    return this.media.generatePromoComposite(dto.promoType, dto.data, dto.imageUrls);
  }

  /** Generate promotion poster via AI prompt + GPT Image (optional AI Creative mode) */
  @Post('promo/generate-gpt')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  generatePromoGpt(@Body() dto: GeneratePromoGptDto) {
    return this.media.generatePromoGptImage(dto.promoType, dto.data, dto.referenceImageUrl);
  }

  /** Save client-rendered promotion poster PNG */
  @Post('promo/save')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  savePromo(@Body() dto: SavePromoDto) {
    return this.media.savePromoImage(dto.promoType, dto.dataUrl);
  }

  /** AI-generate 3 short feature lines for New Arrival template */
  @Post('promo/features/:sku')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  generatePromoFeatures(@Param('sku') sku: string) {
    return this.media.generatePromoFeatures(sku);
  }

  /** Proxy ERP product image (same-origin for html-to-image) */
  @Public()
  @Get('proxy-image')
  async proxyImage(@Query('url') url: string, @Res() res: Response) {
    const { buffer, contentType } = await this.media.proxyImage(url);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  }

  /** Batch generate benefit images */
  @Post('products/batch-image')
  @Roles('admin', 'super_admin', 'marketing_manager')
  @HttpCode(HttpStatus.OK)
  batchImage(@Body() dto: BatchImageDto) {
    return this.media.batchGenerateBenefitImages(dto.skus);
  }

  /** List locally generated media files */
  @Get('files')
  listFiles() {
    return this.media.listGeneratedFiles();
  }

  /** Serve a generated media file (public — img tags cannot send JWT) */
  @Public()
  @Get('serve/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const safe = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'media', safe);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');
    const stat = fs.statSync(filePath);
    if (safe.endsWith('.mp4') && stat.size < 1024) {
      throw new BadRequestException('Video file is not ready or invalid. Please regenerate the video.');
    }
    const mime = safe.endsWith('.mp4') ? 'video/mp4' : 'image/png';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Accept-Ranges', 'bytes');
    res.sendFile(filePath);
  }

  /** Delete a generated media file */
  @Delete('files/:filename')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  deleteFile(@Param('filename') filename: string) {
    return this.media.deleteGeneratedFile(filename);
  }

  /** Submit video generation task */
  @Post('products/video')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  async submitVideo(@Body() dto: VideoSubmitDto, @CurrentUser() _user: AuthUser) {
    const configured = await this.video.isConfigured(dto.provider);
    if (!configured) {
      return {
        error: true,
        message: 'ยังไม่ได้ตั้งค่า API Key สำหรับ Video AI provider ที่เลือก — ไปที่ หน้าตั้งค่า → Video AI Configuration',
      };
    }
    try {
      return await this.video.submitProductVideo(dto.sku, dto);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'ส่งคำขอ Video ล้มเหลว');
    }
  }

  /** Poll video task status */
  @Post('video/poll')
  @HttpCode(HttpStatus.OK)
  pollVideo(@Body() dto: PollVideoDto) {
    return this.video.pollVideoTask(dto.taskId, dto);
  }

  /** Generate video + wait for completion (async, may take minutes) */
  @Post('products/:sku/video/generate')
  @Roles('admin', 'super_admin', 'marketing_manager')
  @HttpCode(HttpStatus.OK)
  async generateVideo(@Param('sku') sku: string, @Body() dto: Omit<VideoSubmitDto, 'sku'> = {}) {
    const configured = await this.video.isConfigured(dto.provider);
    if (!configured) {
      return {
        error: true,
        message: 'ยังไม่ได้ตั้งค่า API Key สำหรับ Video AI provider ที่เลือก — ไปที่ หน้าตั้งค่า → Video AI Configuration',
      };
    }
    try {
      return await this.video.generateAndWait(sku, dto);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'สร้าง Video ล้มเหลว');
    }
  }

  /** Google Drive status */
  @Get('drive/status')
  async driveStatus() {
    const configured = await this.drive.isConfigured();
    return { configured };
  }

  /** Sync all local media to Google Drive */
  @Post('drive/sync')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async driveSync() {
    const configured = await this.drive.isConfigured();
    if (!configured) {
      return {
        error: true,
        message: 'ยังไม่ได้ตั้งค่า Google Drive Service Account — ไปที่ หน้าตั้งค่า → Google Drive',
      };
    }
    return this.drive.syncMediaFolder();
  }

  /** Upload a single file to Drive by filename */
  @Post('drive/upload')
  @Roles('admin', 'super_admin', 'marketing_manager')
  @HttpCode(HttpStatus.OK)
  async driveUpload(
    @Body() body: { filename: string },
    @CurrentUser() _user: AuthUser,
  ) {
    const pathModule = await import('path');
    const localPath = pathModule.join(process.cwd(), 'uploads', 'media', body.filename);
    const mime = body.filename.endsWith('.mp4') ? 'video/mp4' : 'image/png';
    return this.drive.uploadFile(localPath, mime);
  }
}
