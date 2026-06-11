import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export type RoleName =
  | 'super_admin'
  | 'admin'
  | 'marketing_manager'
  | 'marketing_staff'
  | 'branch_manager'
  | 'customer_service';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  name: RoleName;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];
}
