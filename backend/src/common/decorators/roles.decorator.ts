import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../../database/entities';

export const ROLES_KEY = 'roles';

/** กำหนดบทบาทที่อนุญาตให้เข้าถึง route */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
