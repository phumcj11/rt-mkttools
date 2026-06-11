import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { Tenant } from '../../database/entities';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(@InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>) {}

  async findById(id: number) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundAppException();
    }
    return this.serialize(tenant);
  }

  async update(id: number, dto: UpdateTenantDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundAppException();
    }
    if (dto.name !== undefined) tenant.name = dto.name;
    if (dto.locale !== undefined) tenant.locale = dto.locale;

    const saved = await this.tenantRepo.save(tenant);
    return this.serialize(saved);
  }

  private serialize(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      locale: tenant.locale,
      createdAt: tenant.createdAt,
    };
  }
}
