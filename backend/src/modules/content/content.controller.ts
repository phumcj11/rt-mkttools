import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ContentService } from './content.service';
import {
  CreateContentDto,
  GenerateManusAssetDto,
  PublishBlotatoDto,
  PublishLineDto,
  ScheduleContentDto,
  UpdateAssetStatusDto,
  UpdateContentStatusDto,
} from './dto/create-content.dto';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.contentService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.contentService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContentDto) {
    return this.contentService.create(user.tenantId, user.id, dto);
  }

  @Patch(':id/status')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentStatusDto,
  ) {
    return this.contentService.updateStatus(user.tenantId, id, dto.status);
  }

  @Patch(':id/schedule')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  schedule(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ScheduleContentDto,
  ) {
    return this.contentService.schedule(user.tenantId, id, new Date(dto.scheduledAt));
  }

  @Get(':id/assets')
  listAssets(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.contentService.listAssets(user.tenantId, id);
  }

  @Post(':id/assets/manus')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  generateManusAsset(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateManusAssetDto,
  ) {
    return this.contentService.generateManusAsset(user.tenantId, user.id, id, dto);
  }

  @Post(':id/assets/:assetId/refresh')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  refreshManusAsset(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    return this.contentService.refreshManusAsset(user.tenantId, id, assetId);
  }

  @Patch(':id/assets/:assetId/status')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  updateAssetStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
    @Body() dto: UpdateAssetStatusDto,
  ) {
    return this.contentService.updateAssetStatus(user.tenantId, id, assetId, dto.status);
  }

  @Post(':id/publish/line')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  publishLine(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishLineDto,
  ) {
    return this.contentService.publishLine(user.tenantId, user.id, id, dto.lineUserId);
  }

  @Post(':id/publish/gbp')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  publishGbp(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.contentService.publishGbp(user.tenantId, id);
  }

  @Post(':id/publish/blotato')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  publishBlotato(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishBlotatoDto,
  ) {
    return this.contentService.publishBlotato(user.tenantId, user.id, id, dto);
  }

  @Get(':id/publish-jobs')
  listPublishJobs(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.contentService.listPublishJobs(user.tenantId, id);
  }

  @Post('publish-jobs/:jobId/refresh')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  refreshPublishJob(@CurrentUser() user: AuthUser, @Param('jobId', ParseIntPipe) jobId: number) {
    return this.contentService.refreshPublishJob(user.tenantId, jobId);
  }

  @Public()
  @Post('webhooks/manus')
  @HttpCode(HttpStatus.OK)
  manusWebhook(@Body() body: unknown) {
    return this.contentService.applyManusWebhook(body);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.contentService.remove(user.tenantId, id);
    return { message: 'ลบคอนเทนต์เรียบร้อย' };
  }
}
