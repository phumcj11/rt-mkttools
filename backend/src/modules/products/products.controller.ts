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
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.productsService.findAll(user.tenantId);
  }

  @Get('catalog')
  catalog(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('abc') abc?: string,
    @Query('filter') filter?: 'all' | 'new' | 'changed' | 'missing_image' | 'ready' | 'low_gp' | 'promo' | 'inactive',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.catalog({
      q,
      category,
      brand,
      abc,
      filter,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('catalog/status')
  catalogStatus() {
    return this.productsService.catalogStatus();
  }

  @Post('catalog/sync')
  @Roles('super_admin', 'admin')
  catalogSync() {
    return this.productsService.syncCatalog();
  }

  @Get('catalog/:sku')
  catalogDetail(@Param('sku') sku: string) {
    return this.productsService.catalogDetail(sku);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin', 'marketing_manager', 'marketing_staff')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin', 'marketing_manager')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.productsService.remove(user.tenantId, id);
    return { message: 'ลบสินค้าเรียบร้อย' };
  }
}
