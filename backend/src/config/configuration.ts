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

export interface RootConfig {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
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
});
