import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import {
  Category,
  ErpProductCache,
  ErpSalesSummary,
  Product,
  ProductPromotionSnapshot,
  ProductSyncRun,
} from '../../database/entities';
import { ErpSyncService } from '../erp/erp-sync.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export interface ProductCatalogQuery {
  q?: string;
  category?: string;
  brand?: string;
  abc?: string;
  filter?: 'all' | 'new' | 'changed' | 'missing_image' | 'ready' | 'low_gp' | 'promo' | 'inactive';
  page?: number;
  limit?: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectRepository(ErpProductCache) private readonly cacheRepo: Repository<ErpProductCache>,
    @InjectRepository(ErpSalesSummary) private readonly salesRepo: Repository<ErpSalesSummary>,
    @InjectRepository(ProductPromotionSnapshot) private readonly promoRepo: Repository<ProductPromotionSnapshot>,
    @InjectRepository(ProductSyncRun) private readonly syncRunRepo: Repository<ProductSyncRun>,
    private readonly erpSync: ErpSyncService,
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

  // ---------- product catalog ----------

  async catalog(query: ProductCatalogQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(Number(query.limit) || 50, 200));
    const qb = this.cacheRepo
      .createQueryBuilder('p')
      .leftJoin(ErpSalesSummary, 's', 's.sku = p.sku')
      .leftJoin(ProductPromotionSnapshot, 'promo', 'promo.sku = p.sku')
      .select([
        'p.sku AS sku',
        'p.product_id AS productId',
        'p.name AS name',
        'p.category AS category',
        'p.brand AS brand',
        'p.retail_price AS retailPrice',
        'p.cost_sales AS costSales',
        'p.image_url AS imageUrl',
        'p.abc_company AS abcCompany',
        'p.first_seen_at AS firstSeenAt',
        'p.last_seen_at AS lastSeenAt',
        'p.last_changed_at AS lastChangedAt',
        'p.is_active AS isActive',
        'p.synced_at AS syncedAt',
        's.revenue AS revenue',
        's.qty_sold AS qtySold',
        's.gp_baht AS gpBaht',
        's.gp_pct AS salesGpPct',
        's.period_days AS periodDays',
        'promo.active_promotion_count AS activePromotionCount',
        'promo.promotion_names AS promotionNames',
        'promo.lowest_promo_price AS lowestPromoPrice',
        'promo.best_remaining_gp_pct AS bestRemainingGpPct',
      ]);

    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      qb.andWhere('(p.sku LIKE :q OR p.name LIKE :q OR p.brand LIKE :q)', { q });
    }
    if (query.category) qb.andWhere('p.category = :category', { category: query.category });
    if (query.brand) qb.andWhere('p.brand = :brand', { brand: query.brand });
    if (query.abc) qb.andWhere('p.abc_company = :abc', { abc: query.abc });

    const since = new Date();
    since.setDate(since.getDate() - 7);
    switch (query.filter) {
      case 'new':
        qb.andWhere('p.first_seen_at >= :since', { since });
        break;
      case 'changed':
        qb.andWhere('p.last_changed_at >= :since AND (p.first_seen_at IS NULL OR p.last_changed_at <> p.first_seen_at)', { since });
        break;
      case 'missing_image':
        qb.andWhere("(p.image_url IS NULL OR p.image_url = '')");
        break;
      case 'ready':
        qb.andWhere("p.is_active = 1 AND p.retail_price > 0 AND p.cost_sales > 0 AND p.image_url <> ''");
        break;
      case 'low_gp':
        qb.andWhere('p.retail_price > 0 AND p.cost_sales > 0 AND ((p.retail_price - p.cost_sales) / p.retail_price * 100) < 25');
        break;
      case 'promo':
        qb.andWhere('promo.active_promotion_count > 0');
        break;
      case 'inactive':
        qb.andWhere('p.is_active = 0');
        break;
      default:
        qb.andWhere('p.is_active = 1');
    }

    const totalQb = qb.clone();
    const rows = await qb
      .orderBy('p.last_changed_at', 'DESC')
      .addOrderBy('p.synced_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();
    const total = await totalQb.getCount();

    return {
      items: rows.map((r) => this.toCatalogItem(r)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async catalogDetail(sku: string) {
    const normalSku = sku.replace(/\s+/g, '').toUpperCase();
    const [product, sales, promo] = await Promise.all([
      this.cacheRepo.findOne({ where: { sku: normalSku } }),
      this.salesRepo.findOne({ where: { sku: normalSku } }),
      this.promoRepo.findOne({ where: { sku: normalSku } }),
    ]);
    if (!product) throw new NotFoundAppException();
    return this.toCatalogItem({
      sku: product.sku,
      productId: product.productId,
      name: product.name,
      category: product.category,
      brand: product.brand,
      retailPrice: product.retailPrice,
      costSales: product.costSales,
      imageUrl: product.imageUrl,
      abcCompany: product.abcCompany,
      firstSeenAt: product.firstSeenAt,
      lastSeenAt: product.lastSeenAt,
      lastChangedAt: product.lastChangedAt,
      isActive: product.isActive,
      syncedAt: product.syncedAt,
      revenue: sales?.revenue ?? 0,
      qtySold: sales?.qtySold ?? 0,
      gpBaht: sales?.gpBaht ?? 0,
      salesGpPct: sales?.gpPct ?? 0,
      periodDays: sales?.periodDays ?? 0,
      activePromotionCount: promo?.activePromotionCount ?? 0,
      promotionNames: promo?.promotionNames ?? '',
      lowestPromoPrice: promo?.lowestPromoPrice ?? null,
      bestRemainingGpPct: promo?.bestRemainingGpPct ?? null,
    }, promo?.promotions ?? []);
  }

  catalogStatus() {
    return this.erpSync.getCacheStatus();
  }

  syncCatalog() {
    return this.erpSync.syncProductMarketing('manual');
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

  private toCatalogItem(row: Record<string, unknown>, promotions?: unknown) {
    const retailPrice = Number(row.retailPrice ?? 0);
    const costSales = Number(row.costSales ?? 0);
    const marginGpPct = retailPrice > 0 && costSales > 0
      ? Math.round(((retailPrice - costSales) / retailPrice) * 1000) / 10
      : 0;
    const salesGpPct = Number(row.salesGpPct ?? 0);
    const effectiveGpPct = Math.max(marginGpPct, salesGpPct);
    const activePromotionCount = Number(row.activePromotionCount ?? 0);
    const flags: string[] = [];
    if (!row.imageUrl) flags.push('missing_image');
    if (!retailPrice) flags.push('missing_price');
    if (!costSales) flags.push('missing_cost');
    if (retailPrice && costSales && marginGpPct < 25) flags.push('low_gp');
    if (activePromotionCount > 0) flags.push('has_promotion');

    return {
      sku: String(row.sku ?? ''),
      productId: Number(row.productId ?? 0),
      name: String(row.name ?? ''),
      category: String(row.category ?? ''),
      brand: String(row.brand ?? ''),
      retailPrice,
      costSales,
      marginGpPct,
      salesGpPct,
      effectiveGpPct,
      imageUrl: String(row.imageUrl ?? ''),
      abcCompany: String(row.abcCompany ?? ''),
      revenue: Number(row.revenue ?? 0),
      qtySold: Number(row.qtySold ?? 0),
      gpBaht: Number(row.gpBaht ?? 0),
      periodDays: Number(row.periodDays ?? 0),
      activePromotionCount,
      promotionNames: String(row.promotionNames ?? ''),
      lowestPromoPrice: row.lowestPromoPrice === null || row.lowestPromoPrice === undefined ? null : Number(row.lowestPromoPrice),
      bestRemainingGpPct: row.bestRemainingGpPct === null || row.bestRemainingGpPct === undefined ? null : Number(row.bestRemainingGpPct),
      promotions,
      isActive: Boolean(Number(row.isActive ?? 0)),
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      lastChangedAt: row.lastChangedAt,
      syncedAt: row.syncedAt,
      marketingReadiness: flags.length === 0 ? 'ready' : flags[0],
      flags,
    };
  }
}
