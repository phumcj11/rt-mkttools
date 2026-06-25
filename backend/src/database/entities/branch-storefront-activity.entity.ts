import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('branch_storefront_activities')
@Index('idx_storefront_activity_tenant_date', ['tenantId', 'activityDate'])
@Index('idx_storefront_activity_branch', ['tenantId', 'branchId', 'activityDate'])
export class BranchStorefrontActivity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'branch_id', type: 'int' })
  branchId: number;

  @Column({ name: 'branch_code', type: 'varchar', length: 50, nullable: true })
  branchCode: string | null;

  @Column({ name: 'activity_date', type: 'date' })
  activityDate: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'photo_urls', type: 'json', nullable: true })
  photoUrls: string[] | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
