import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreatePosmDto } from './dto/create-posm.dto';
import { PosmService } from './posm.service';

@Controller('posm')
export class PosmController {
  constructor(private readonly posmService: PosmService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.posmService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.posmService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  generate(@CurrentUser() user: AuthUser, @Body() dto: CreatePosmDto) {
    return this.posmService.generate(user.tenantId, user.id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.posmService.remove(user.tenantId, id);
    return { message: 'ลบโปรเจกต์ POSM เรียบร้อย' };
  }
}
