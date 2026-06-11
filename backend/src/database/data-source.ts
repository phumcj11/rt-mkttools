import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  PasswordReset,
  RefreshToken,
  Role,
  Tenant,
  User,
} from './entities';

// โหลด .env จาก root ของ monorepo ก่อน แล้ว fallback มาที่ backend/.env
loadEnv({ path: join(__dirname, '..', '..', '..', '.env') });
loadEnv();

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'rt_mkttools',
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  entities: [Tenant, User, Role, RefreshToken, PasswordReset],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
