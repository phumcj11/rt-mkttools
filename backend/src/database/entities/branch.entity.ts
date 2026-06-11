import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BranchStatus = 'active' | 'inactive';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_branches_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: BranchStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
