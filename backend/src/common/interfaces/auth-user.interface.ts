import { RoleName } from '../../database/entities';

/**
 * รูปแบบข้อมูลผู้ใช้ที่แนบกับ request หลังผ่าน JWT guard
 */
export interface AuthUser {
  id: number;
  tenantId: number;
  email: string;
  roles: RoleName[];
  locale: string;
}

export interface JwtPayload {
  sub: number;
  tenantId: number;
  email: string;
  roles: RoleName[];
  locale: string;
}
