import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { Branch } from '../../database/entities';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
  ) {}

  findAll(tenantId: number) {
    return this.branchRepo.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async findOne(tenantId: number, id: number) {
    const branch = await this.branchRepo.findOne({ where: { id, tenantId } });
    if (!branch) throw new NotFoundAppException();
    return branch;
  }

  create(tenantId: number, dto: CreateBranchDto) {
    return this.branchRepo.save(
      this.branchRepo.create({
        tenantId,
        name: dto.name,
        code: dto.code ?? null,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        status: dto.status ?? 'active',
      }),
    );
  }

  async update(tenantId: number, id: number, dto: UpdateBranchDto) {
    const branch = await this.findOne(tenantId, id);
    Object.assign(branch, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
    return this.branchRepo.save(branch);
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const branch = await this.findOne(tenantId, id);
    await this.branchRepo.remove(branch);
  }
}
