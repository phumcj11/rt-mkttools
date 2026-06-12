import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.reviewsService.getStats(user.tenantId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    return this.reviewsService.findAll(user.tenantId, branchId ? Number(branchId) : undefined);
  }

  @Post()
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'branch_manager')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.tenantId, dto);
  }

  @Post(':id/generate-reply')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'branch_manager')
  generateReply(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.generateReply(user.tenantId, id);
  }

  @Post(':id/mark-replied')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'branch_manager')
  markReplied(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.markReplied(user.tenantId, id);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin', 'marketing_manager')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.reviewsService.remove(user.tenantId, id);
    return { message: 'ลบรีวิวเรียบร้อย' };
  }
}
