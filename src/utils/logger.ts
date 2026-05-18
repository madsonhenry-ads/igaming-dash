import pino from 'pino';

export function createLogger(level?: string) {
  return pino({
    level: level || process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'body.email',
        'body.phone',
        'body.token',
        'body.signature',
        'body.hash',
      ],
      censor: '[REDACTED]',
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;