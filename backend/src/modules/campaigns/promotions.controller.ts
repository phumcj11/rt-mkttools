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
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CampaignsService } from './campaigns.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('campaignId') campaignId?: string,
  ) {
    const id = campaignId ? parseInt(campaignId, 10) : undefined;
    return this.campaignsService.findPromotions(user.tenantId, id);
  }

  @Post()
  @Roles('owner', 'admin', 'editor')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePromotionDto) {
    return this.campaignsService.createPromotion(user.tenantId, dto);
  }

  @Delete(':id')
  @Roles('owner', 'admin', 'editor')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.campaignsService.removePromotion(user.tenantId, id);
    return { message: 'ลบโปรโมชั่นเรียบร้อย' };
  }
}
