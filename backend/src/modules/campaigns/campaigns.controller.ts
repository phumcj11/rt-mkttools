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
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    return this.campaignsService.findAll(user.tenantId, this.parseBranch(branchId));
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('owner', 'admin', 'editor')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user.tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles('owner', 'admin', 'editor')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('owner', 'admin', 'editor')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.campaignsService.remove(user.tenantId, id);
    return { message: 'ลบแคมเปญเรียบร้อย' };
  }

  private parseBranch(branchId?: string): number | undefined {
    if (branchId === undefined || branchId === '' || branchId === 'all') return undefined;
    const n = Number(branchId);
    return Number.isNaN(n) ? undefined : n;
  }
}
