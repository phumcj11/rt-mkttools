import {
  Body,
  Controller,
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
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { DriveService } from './drive.service';
import { MediaService } from './media.service';
import { VideoService } from './video.service';

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

class VideoSubmitDto {
  @IsString()
  @IsNotEmpty()
  sku: string;
}

class PollVideoDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsOptional()
  @IsString()
  taskType?: 'image2video' | 'text2video';
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

  /** Save client-rendered benefit poster PNG */
  @Post('products/:sku/poster')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  savePoster(@Param('sku') sku: string, @Body() body: { dataUrl: string }) {
    return this.media.savePosterImage(sku, body.dataUrl);
  }

  /** Generate promotion poster via AI prompt + GPT Image */
  @Post('promo/generate')
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
    const mime = safe.endsWith('.mp4') ? 'video/mp4' : 'image/png';
    res.setHeader('Content-Type', mime);
    res.sendFile(filePath);
  }

  /** Submit video generation task */
  @Post('products/video')
  @Roles('admin', 'super_admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  async submitVideo(@Body() dto: VideoSubmitDto, @CurrentUser() user: AuthUser) {
    const configured = await this.video.isConfigured();
    if (!configured) {
      return {
        error: true,
        message: 'ยังไม่ได้ตั้งค่า Kling AI API Key — ไปที่ หน้าตั้งค่า → Video AI Configuration',
      };
    }
    return this.video.submitProductVideo(dto.sku);
  }

  /** Poll video task status */
  @Post('video/poll')
  @HttpCode(HttpStatus.OK)
  pollVideo(@Body() dto: PollVideoDto) {
    return this.video.pollVideoTask(dto.taskId, dto.taskType);
  }

  /** Generate video + wait for completion (async, may take minutes) */
  @Post('products/:sku/video/generate')
  @Roles('admin', 'super_admin', 'marketing_manager')
  @HttpCode(HttpStatus.OK)
  async generateVideo(@Param('sku') sku: string) {
    const configured = await this.video.isConfigured();
    if (!configured) {
      return {
        error: true,
        message: 'ยังไม่ได้ตั้งค่า Kling AI API Key — ไปที่ หน้าตั้งค่า → Video AI Configuration',
      };
    }
    return this.video.generateAndWait(sku);
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
