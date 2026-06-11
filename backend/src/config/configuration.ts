export interface AppConfig {
  env: string;
  name: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  defaultLocale: string;
  supportedLocales: string[];
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectionLimit: number;
  logging: boolean;
  synchronize: boolean;
}

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  bcryptSaltRounds: number;
}

export interface AiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  monthlyTokenLimit: number;
}

export interface RealtimeConfig {
  path: string;
  corsOrigins: string[];
}

export interface ErpConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export interface RootConfig {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  ai: AiConfig;
  realtime: RealtimeConfig;
  erp: ErpConfig;
}

const toBool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

const toList = (value: string | undefined, fallback: string[] = []): string[] => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export default (): RootConfig => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    name: process.env.APP_NAME ?? '100 Baht Shop Marketing AI',
    port: parseInt(process.env.BACKEND_PORT ?? '4000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: toList(process.env.CORS_ORIGINS, ['http://localhost:3000']),
    defaultLocale: process.env.DEFAULT_LOCALE ?? 'th',
    supportedLocales: toList(process.env.SUPPORTED_LOCALES, ['th', 'en']),
  },
  database: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'rt_mkttools',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT ?? '10', 10),
    logging: toBool(process.env.DB_LOGGING, false),
    synchronize: toBool(process.env.DB_SYNCHRONIZE, false),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change_me_access_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change_me_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
  },
  ai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS ?? '1024', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
    monthlyTokenLimit: parseInt(process.env.AI_MONTHLY_TOKEN_LIMIT ?? '1000000', 10),
  },
  realtime: {
    path: process.env.SOCKET_PATH ?? '/socket.io',
    // ใช้ origin เดียวกับ CORS ของ REST หากไม่ได้ตั้ง SOCKET_CORS_ORIGINS แยก
    corsOrigins: toList(
      process.env.SOCKET_CORS_ORIGINS ?? process.env.CORS_ORIGINS,
      ['http://localhost:3000'],
    ),
  },
  erp: {
    baseUrl:
      process.env.ERP_API_BASE_URL ??
      'https://dev.changsiamthailand.com/webservice/api.php',
    apiKey: process.env.ERP_API_KEY ?? '',
    timeoutMs: parseInt(process.env.ERP_API_TIMEOUT_MS ?? '20000', 10),
  },
});
