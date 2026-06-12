import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateKeywordDto } from './dto/create-keyword.dto';
import { CreateMentionDto } from './dto/create-mention.dto';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.socialService.getMentionStats(user.tenantId);
  }

  @Get('mentions')
  findMentions(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.socialService.findAllMentions(user.tenantId, limit ? Number(limit) : 100);
  }

  @Post('mentions')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  createMention(@CurrentUser() user: AuthUser, @Body() dto: CreateMentionDto) {
    return this.socialService.createMention(user.tenantId, dto);
  }

  @Delete('mentions/:id')
  @Roles('super_admin', 'admin', 'marketing_manager')
  @HttpCode(HttpStatus.OK)
  async removeMention(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.socialService.removeMention(user.tenantId, id);
    return { message: 'ลบ mention เรียบร้อย' };
  }

  @Get('keywords')
  findKeywords(@CurrentUser() user: AuthUser) {
    return this.socialService.findAllKeywords(user.tenantId);
  }

  @Post('keywords')
  @Roles('super_admin', 'admin', 'marketing_manager')
  createKeyword(@CurrentUser() user: AuthUser, @Body() dto: CreateKeywordDto) {
    return this.socialService.createKeyword(user.tenantId, dto);
  }

  @Delete('keywords/:id')
  @Roles('super_admin', 'admin', 'marketing_manager')
  @HttpCode(HttpStatus.OK)
  async removeKeyword(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.socialService.removeKeyword(user.tenantId, id);
    return { message: 'ลบ keyword เรียบร้อย' };
  }
}
