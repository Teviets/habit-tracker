import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DB_POOL_SIZE: z.coerce.number().int().positive().max(100).default(10),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const fields = result.error.issues.map((issue) => issue.path.join('.') || 'environment').join(', ');
  throw new Error(`Invalid environment variables: ${fields}`);
}

export const env = {
  ...result.data,
  CORS_ORIGINS: result.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
};
