import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  AiAgent,
  AiRequest,
  AiTask,
  AiTemplate,
  AiUsage,
  AuditLog,
  Branch,
  Campaign,
  Category,
  ChatMessage,
  ChatThread,
  ContentItem,
  ErpSalesDaily,
  GoogleReview,
  ListeningKeyword,
  Notification,
  PasswordReset,
  PosmProject,
  Product,
  Promotion,
  RefreshToken,
  Role,
  SalesRecord,
  SocialMention,
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
  entities: [
    Tenant,
    User,
    Role,
    RefreshToken,
    PasswordReset,
    AiTemplate,
    AiRequest,
    AiUsage,
    ContentItem,
    Category,
    Product,
    Campaign,
    Promotion,
    Notification,
    ChatThread,
    ChatMessage,
    SalesRecord,
    Branch,
    AuditLog,
    ErpSalesDaily,
    PosmProject,
    GoogleReview,
    SocialMention,
    ListeningKeyword,
    AiAgent,
    AiTask,
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
