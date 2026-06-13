import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  ErpProductCache,
  ErpSalesSummary,
  Product,
  ProductPromotionSnapshot,
  ProductSyncRun,
} from '../../database/entities';
import { ErpModule } from '../erp/erp.module';
import { CategoriesController } from './categories.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      ErpProductCache,
      ErpSalesSummary,
      ProductPromotionSnapshot,
      ProductSyncRun,
    ]),
    ErpModule,
  ],
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
