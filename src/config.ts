import { AppConfig } from './types/index';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(optionalEnv('PORT', '3000')!, 10),
    meta: {
      pixelId: requireEnv('FACEBOOK_PIXEL_ID'),
      accessToken: requireEnv('FACEBOOK_ACCESS_TOKEN'),
      apiVersion: optionalEnv('META_API_VERSION', 'v22.0')!,
      testEventCode: optionalEnv('META_TEST_EVENT_CODE'),
    },
    postback: {
      securityToken: optionalEnv('POSTBACK_SECURITY_TOKEN'),
      allowedIps: optionalEnv('POSTBACK_ALLOWED_IPS')?.split(',').map(s => s.trim()),
    },
    database: {
      url: requireEnv('DATABASE_URL'),
    },
    dedup: {
      ttlMinutes: parseInt(optionalEnv('DEDUP_TTL_MINUTES', '1440')!, 10), // 24h default
    },
    retry: {
      maxAttempts: parseInt(optionalEnv('RETRY_MAX_ATTEMPTS', '3')!, 10),
      baseDelayMs: parseInt(optionalEnv('RETRY_BASE_DELAY_MS', '1000')!, 10),
    },
    batch: {
      maxSize: parseInt(optionalEnv('BATCH_MAX_SIZE', '10')!, 10),
      flushIntervalMs: parseInt(optionalEnv('BATCH_FLUSH_INTERVAL_MS', '5000')!, 10),
    },
  };
}

export { AppConfig };