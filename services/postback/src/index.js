import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

const fastify = Fastify({
  logger: true
});

// Configuração
const config = {
  port: process.env.PORT || 3001,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://dashigaming:changeme@localhost:15432/dashigaming',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:16379',
  jwtSecret: new TextEncoder().encode(process.env.JWT_SECRET || 'changeme'),
  webhookSecret: process.env.WEBHOOK_SECRET || 'changeme'
};

// PostgreSQL
const pool = new Pool({ connectionString: config.databaseUrl });

// Redis
const redis = new Redis(config.redisUrl);

// Schemas de validação
const postbackSchema = z.object({
  clickId: z.string().min(1),
  event: z.enum(['deposit', 'registration', 'bet', 'withdrawal']),
  amount: z.number().nonnegative().optional(),
  currency: z.string().default('USD'),
  timestamp: z.string().datetime(),
  userId: z.string().optional(),
  ip: z.string().ip().optional()
});

// Inicialização
async function init() {
  // Registrar plugins
  await fastify.register(cors);
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'DASH-IGAMING Postback API',
        version: '1.0.0'
      }
    }
  });
  await fastify.register(swaggerUi, {
    routePrefix: '/docs'
  });

  // Verificar conexões
  try {
    await pool.query('SELECT 1');
    fastify.log.info('PostgreSQL connected');
    await redis.ping();
    fastify.log.info('Redis connected');
  } catch (err) {
    fastify.log.error('Database connection failed:', err);
    process.exit(1);
  }

  // Middleware de autenticação de webhook
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health' || request.url.startsWith('/docs')) return;

    const authHeader = request.headers['authorization'];
    const signature = request.headers['x-webhook-signature'];

    if (!authHeader && !signature) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (signature) {
      const hmac = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(request.body) + config.webhookSecret)
      );
      const expectedSig = Array.from(new Uint8Array(hmac))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (signature !== `sha256=${expectedSig}`) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }
    }
  });

  // Rotas
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  fastify.post('/api/v1/postback', async (request, reply) => {
    try {
      const data = postbackSchema.parse(request.body);

      // Verificar duplicidade
      const duplicateKey = `postback:${data.clickId}:${data.event}:${data.timestamp}`;
      const exists = await redis.exists(duplicateKey);

      if (exists) {
        return reply.code(200).send({ status: 'duplicate', message: 'Postback already processed' });
      }

      // Salvar no banco
      const result = await pool.query(
        `INSERT INTO postbacks (click_id, event, amount, currency, timestamp, user_id, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [data.clickId, data.event, data.amount || 0, data.currency, data.timestamp, data.userId, data.ip]
      );

      // Cache por 24h
      await redis.setex(duplicateKey, 86400, result.rows[0].id);

      // Publicar evento para outros serviços
      await redis.publish('postback:events', JSON.stringify({
        ...data,
        id: result.rows[0].id
      }));

      fastify.log.info(`Postback processed: clickId=${data.clickId}, event=${data.event}`);

      return reply.code(200).send({
        status: 'success',
        id: result.rows[0].id,
        message: 'Postback processed successfully'
      });

    } catch (err) {
      if (err.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors });
      }
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/api/v1/postbacks/:clickId', async (request, reply) => {
    const { clickId } = request.params;

    const result = await pool.query(
      'SELECT * FROM postbacks WHERE click_id = $1 ORDER BY created_at DESC',
      [clickId]
    );

    return reply.code(200).send({ data: result.rows });
  });

  // Iniciar servidor
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  fastify.log.info(`Postback service running on port ${config.port}`);
}

// Tabela necessária (criar manualmente ou via migration)
// CREATE TABLE postbacks (
//   id SERIAL PRIMARY KEY,
//   click_id VARCHAR(255) NOT NULL,
//   event VARCHAR(50) NOT NULL,
//   amount DECIMAL(10, 2) DEFAULT 0,
//   currency VARCHAR(3) DEFAULT 'USD',
//   timestamp TIMESTAMP NOT NULL,
//   user_id VARCHAR(255),
//   ip VARCHAR(45),
//   created_at TIMESTAMP DEFAULT NOW(),
//   INDEX idx_click_id (click_id),
//   INDEX idx_event (event),
//   INDEX idx_created_at (created_at)
// );

init().catch(err => {
  fastify.log.error(err);
  process.exit(1);
});
