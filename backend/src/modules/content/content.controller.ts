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
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ContentService } from './content.service';
import {
  CreateContentDto,
  PublishLineDto,
  ScheduleContentDto,
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

  @Delete(':id')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.contentService.remove(user.tenantId, id);
    return { message: 'ลบคอนเทนต์เรียบร้อย' };
  }
}
