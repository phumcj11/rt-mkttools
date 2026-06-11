import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_templates')
export class AiTemplate {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_aitemplates_tenant')
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true, nullable: true })
  tenantId: number | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null;

  @Column({ type: 'mediumtext' })
  prompt: string;

  @Column({ type: 'varchar', length: 5, default: 'th' })
  locale: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
