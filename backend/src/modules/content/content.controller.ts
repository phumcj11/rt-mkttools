import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';

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

  @Delete(':id')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.contentService.remove(user.tenantId, id);
    return { message: 'ลบคอนเทนต์เรียบร้อย' };
  }
}
