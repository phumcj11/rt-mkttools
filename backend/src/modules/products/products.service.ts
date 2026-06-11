import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { Category, Product } from '../../database/entities';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
  ) {}

  // ---------- products ----------

  findAll(tenantId: number) {
    return this.productRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: number, id: number) {
    const product = await this.productRepo.findOne({ where: { id, tenantId } });
    if (!product) throw new NotFoundAppException();
    return product;
  }

  create(tenantId: number, dto: CreateProductDto) {
    return this.productRepo.save(
      this.productRepo.create({
        tenantId,
        name: dto.name,
        price: dto.price,
        categoryId: dto.categoryId ?? null,
        sku: dto.sku ?? null,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        status: dto.status ?? 'active',
      }),
    );
  }

  async update(tenantId: number, id: number, dto: UpdateProductDto) {
    const product = await this.findOne(tenantId, id);
    Object.assign(product, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
    return this.productRepo.save(product);
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const product = await this.findOne(tenantId, id);
    await this.productRepo.remove(product);
  }

  // ---------- categories ----------

  findCategories(tenantId: number) {
    return this.categoryRepo.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  createCategory(tenantId: number, dto: CreateCategoryDto) {
    return this.categoryRepo.save(this.categoryRepo.create({ tenantId, name: dto.name }));
  }

  async removeCategory(tenantId: number, id: number): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id, tenantId } });
    if (!category) throw new NotFoundAppException();
    await this.categoryRepo.remove(category);
  }
}
