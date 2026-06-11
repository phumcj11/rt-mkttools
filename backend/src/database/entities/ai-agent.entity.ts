import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AgentStatus = 'idle' | 'running' | 'error' | 'disabled';

@Entity('ai_agents')
export class AiAgent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ['idle', 'running', 'error', 'disabled'], default: 'idle' })
  status: AgentStatus;

  @Column({ name: 'tasks_completed', type: 'int', unsigned: true, default: 0 })
  tasksCompleted: number;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('ai_tasks')
export class AiTask {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'agent_id', type: 'bigint', unsigned: true, nullable: true })
  agentId: number | null;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: ['queued', 'running', 'done', 'error'], default: 'queued' })
  status: 'queued' | 'running' | 'done' | 'error';

  @Column({ name: 'result', type: 'text', nullable: true })
  result: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
