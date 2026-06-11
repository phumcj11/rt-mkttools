import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { Branch } from '../../database/entities';
import { AuditService } from '../audit/audit.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    private readonly audit: AuditService,
  ) {}

  findAll(tenantId: number) {
    return this.branchRepo.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async findOne(tenantId: number, id: number) {
    const branch = await this.branchRepo.findOne({ where: { id, tenantId } });
    if (!branch) throw new NotFoundAppException();
    return branch;
  }

  async create(tenantId: number, dto: CreateBranchDto, actorUserId?: number) {
    const branch = await this.branchRepo.save(
      this.branchRepo.create({
        tenantId,
        name: dto.name,
        code: dto.code ?? null,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        status: dto.status ?? 'active',
      }),
    );
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'branch.created',
      entity: 'branch',
      entityId: branch.id,
      metadata: { name: branch.name, code: branch.code },
    });
    return branch;
  }

  async update(tenantId: number, id: number, dto: UpdateBranchDto, actorUserId?: number) {
    const branch = await this.findOne(tenantId, id);
    Object.assign(branch, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
    const saved = await this.branchRepo.save(branch);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'branch.updated',
      entity: 'branch',
      entityId: saved.id,
      metadata: { changes: dto },
    });
    return saved;
  }

  async remove(tenantId: number, id: number, actorUserId?: number): Promise<void> {
    const branch = await this.findOne(tenantId, id);
    await this.branchRepo.remove(branch);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'branch.deleted',
      entity: 'branch',
      entityId: id,
      metadata: { name: branch.name },
    });
  }
}
