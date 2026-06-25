import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { getFrontendBaseUrl } from '../../common/utils/app-urls';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ─── Review CRUD ──────────────────────────────────────────────────────────

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.reviewsService.getStats(user.tenantId);
  }

  @Get('stats-by-branch')
  getStatsByBranch(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reviewsService.getStatsByBranch(user.tenantId, from, to);
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

  // ─── Google Business Profile OAuth ────────────────────────────────────────

  /** สถานะการเชื่อมต่อ GBP */
  @Get('google/status')
  getGoogleStatus() {
    return this.reviewsService.getGoogleStatus();
  }

  /** สร้าง OAuth consent URL */
  @Get('google/auth-url')
  async getGoogleAuthUrl() {
    try {
      return await this.reviewsService.getGoogleAuthUrl();
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /**
   * OAuth callback — Google redirects here after user approves.
   * This route must be PUBLIC (no JWT) because Google calls it directly.
   * After exchanging tokens, redirect browser to the frontend reviews page.
   */
  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendBase = getFrontendBaseUrl();
    const locale = process.env.DEFAULT_LOCALE ?? 'th';
    const reviewsPage = `${frontendBase}/${locale}/reviews`;

    if (error) {
      return res.redirect(`${reviewsPage}?google=error&reason=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.redirect(`${reviewsPage}?google=error&reason=no_code`);
    }

    try {
      await this.reviewsService.handleGoogleCallback(code);
      return res.redirect(`${reviewsPage}?google=connected`);
    } catch (err) {
      const msg = encodeURIComponent((err as Error).message);
      return res.redirect(`${reviewsPage}?google=error&reason=${msg}`);
    }
  }

  /** รายการ GBP locations ที่เชื่อมต่ออยู่ */
  @Get('google/locations')
  async getGoogleLocations() {
    try {
      return await this.reviewsService.listGoogleLocations();
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /** บันทึก location ที่เลือก */
  @Post('google/select')
  @HttpCode(HttpStatus.OK)
  async selectGoogleLocation(
    @Body() body: { name: string; title: string },
  ) {
    if (!body?.name) throw new BadRequestException('name is required');
    await this.reviewsService.selectGoogleLocation(body.name, body.title ?? body.name);
    return { ok: true };
  }

  /** ดึงรีวิวจาก GBP API */
  @Post('google/sync')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin', 'marketing_manager')
  async syncGoogleReviews(@CurrentUser() user: AuthUser) {
    try {
      return await this.reviewsService.syncGoogleReviews(user.tenantId);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /** ยกเลิกการเชื่อมต่อ Google */
  @Post('google/disconnect')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin')
  async disconnectGoogle() {
    await this.reviewsService.disconnectGoogle();
    return { ok: true };
  }
}
