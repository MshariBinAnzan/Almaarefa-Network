import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface EnvConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  apiPrefix: string;
  publicBaseUrl: string;
  corsOrigins: string[];
  dbMode: 'auto' | 'pg' | 'pglite';
  databaseUrl: string;
  pgliteDataDir: string;
  autoMigrate: boolean;
  autoSeed: boolean;
  allowedEmailDomains: string[];
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: number;
  jwtRefreshExpiresInDays: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  authRateLimitMaxRequests: number;
  uploadStorageDir: string;
  uploadMaxSizeBytes: number;
  uploadPresignedExpiresSeconds: number;
}

const parseBoolean = (val: string | undefined, defaultVal: boolean): boolean => {
  if (val === undefined || val === '') return defaultVal;
  return val.toLowerCase() === 'true' || val === '1';
};

const parseNumber = (val: string | undefined, defaultVal: number): number => {
  if (val === undefined || val === '') return defaultVal;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? defaultVal : parsed;
};

const port = parseNumber(process.env.PORT, 5000);

export const env: EnvConfig = {
  nodeEnv: (process.env.NODE_ENV as EnvConfig['nodeEnv']) || 'development',
  port,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${port}`,
  corsOrigins: (
    process.env.CORS_ORIGIN ||
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  dbMode: (process.env.DB_MODE as EnvConfig['dbMode']) || 'auto',
  databaseUrl: process.env.DATABASE_URL || '',
  pgliteDataDir:
    process.env.PGLITE_DATA_DIR ||
    path.resolve(process.cwd(), 'database', '.pgdata'),
  autoMigrate: parseBoolean(process.env.AUTO_MIGRATE, true),
  autoSeed: parseBoolean(process.env.AUTO_SEED, true),
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS || 'mcst.edu.sa')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET ||
    'almaarefa_dev_access_secret_change_in_production_2026',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    'almaarefa_dev_refresh_secret_change_in_production_2026',
  jwtAccessExpiresIn: parseNumber(process.env.JWT_ACCESS_EXPIRES_IN, 3600),
  jwtRefreshExpiresInDays: parseNumber(
    process.env.JWT_REFRESH_EXPIRES_IN_DAYS,
    7
  ),
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMaxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
  authRateLimitMaxRequests: parseNumber(
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    30
  ),
  uploadStorageDir:
    process.env.UPLOAD_STORAGE_DIR || path.resolve(process.cwd(), 'uploads'),
  uploadMaxSizeBytes: parseNumber(
    process.env.UPLOAD_MAX_SIZE_BYTES,
    25 * 1024 * 1024
  ),
  uploadPresignedExpiresSeconds: parseNumber(
    process.env.UPLOAD_PRESIGNED_EXPIRES_SECONDS,
    900
  ),
};

