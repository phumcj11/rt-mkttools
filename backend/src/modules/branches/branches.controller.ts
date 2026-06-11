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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.branchesService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.branchesService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('owner', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user.tenantId, dto, user.id);
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.branchesService.remove(user.tenantId, id, user.id);
    return { message: 'ลบสาขาเรียบร้อย' };
  }
}
