import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  APP_NAME: Joi.string().default('100 Baht Shop Marketing AI'),
  BACKEND_PORT: Joi.number().default(4000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  DEFAULT_LOCALE: Joi.string().valid('th', 'en').default('th'),
  SUPPORTED_LOCALES: Joi.string().default('th,en'),

  DB_HOST: Joi.string().default('127.0.0.1'),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_DATABASE: Joi.string().required(),
  DB_CONNECTION_LIMIT: Joi.number().default(10),
  DB_LOGGING: Joi.boolean().truthy('true', '1').falsy('false', '0').default(false),
  DB_SYNCHRONIZE: Joi.boolean().truthy('true', '1').falsy('false', '0').default(false),

  JWT_ACCESS_SECRET: Joi.string().min(8).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(8).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(10),

  OPENAI_API_KEY: Joi.string().allow('').default(''),
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: Joi.number().default(1024),
  OPENAI_TEMPERATURE: Joi.number().default(0.7),
  AI_MONTHLY_TOKEN_LIMIT: Joi.number().default(1000000),

  SOCKET_PATH: Joi.string().default('/socket.io'),
  SOCKET_CORS_ORIGINS: Joi.string().allow('').optional(),
}).unknown(true);
