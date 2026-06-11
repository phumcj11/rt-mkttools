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
import { CreateCategoryDto } from './dto/create-category.dto';
import { ProductsService } from './products.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.productsService.findCategories(user.tenantId);
  }

  @Post()
  @Roles('owner', 'admin', 'editor')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(user.tenantId, dto);
  }

  @Delete(':id')
  @Roles('owner', 'admin', 'editor')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.productsService.removeCategory(user.tenantId, id);
    return { message: 'ลบหมวดหมู่เรียบร้อย' };
  }
}
