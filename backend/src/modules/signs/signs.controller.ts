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
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { SignRequestStatus } from '../../database/entities';
import { CreateSignRequestDto } from './dto/create-sign-request.dto';
import { RespondSignRequestDto } from './dto/respond-sign-request.dto';
import { ReviewSignRequestDto } from './dto/review-sign-request.dto';
import { UpdateSignDraftDto } from './dto/update-sign-draft.dto';
import { UploadTemplateDto } from './dto/upload-template.dto';
import { SignsService } from './signs.service';

@Controller('signs')
export class SignsController {
  constructor(private readonly signs: SignsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: SignRequestStatus) {
    return this.signs.list(user.tenantId, status);
  }

  @Get('formats')
  listFormats() {
    return this.signs.listFormats();
  }

  @Get('templates')
  listTemplates(@CurrentUser() user: AuthUser) {
    return this.signs.listTemplates(user.tenantId);
  }

  @Post('templates')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  uploadTemplate(@CurrentUser() user: AuthUser, @Body() dto: UploadTemplateDto) {
    return this.signs.uploadTemplate(user.tenantId, dto);
  }

  @Delete('templates/:id')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  deleteTemplate(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.signs.deleteTemplate(user.tenantId, id);
  }

  @Get('review-queue')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  reviewQueue(@CurrentUser() user: AuthUser) {
    return this.signs.reviewQueue(user.tenantId);
  }

  @Public()
  @Get('serve/:filename')
  @HttpCode(HttpStatus.OK)
  async serve(@Param('filename') filename: string, @Res() res: Response) {
    const file = await this.signs.serve(filename);
    res.setHeader('Content-Type', file.mime);
    res.sendFile(file.path);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.signs.findDetail(user.tenantId, id);
  }

  @Post()
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'branch_manager')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSignRequestDto) {
    return this.signs.create(user.tenantId, user.id, dto);
  }

  @Post(':id/respond')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'branch_manager')
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondSignRequestDto,
  ) {
    return this.signs.respond(user.tenantId, user.id, id, dto);
  }

  @Post(':id/retry')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'branch_manager')
  retry(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.signs.retryDraft(user.tenantId, user.id, user.roles, id);
  }

  @Post(':id/regenerate')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  regenerate(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.signs.regenerate(user.tenantId, user.id, id);
  }

  @Put(':id/draft')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  updateDraft(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSignDraftDto,
  ) {
    return this.signs.updateDraft(user.tenantId, user.id, id, dto);
  }

  @Post(':id/review')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewSignRequestDto,
  ) {
    return this.signs.review(user.tenantId, user.id, id, dto);
  }

  @Post(':id/export')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  export(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.signs.exportFinal(user.tenantId, id);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff', 'branch_manager')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.signs.removeRequest(user.tenantId, user.id, user.roles, id);
  }

}
