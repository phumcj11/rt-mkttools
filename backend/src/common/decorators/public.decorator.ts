import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** ทำให้ route ไม่ต้องผ่าน JWT guard */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
