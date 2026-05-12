import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import Redis from 'ioredis';
import axios from 'axios';
import cron from 'node-cron';
import { z } from 'zod';

const fastify = Fastify({ logger: true });

// Configuração
const config = {
  port: process.env.PORT || 3002,
  evolutionApiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
  evolutionApiKey: process.env.EVOLUTION_API_KEY || 'changeme',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://dashigaming:changeme@localhost:15432/dashigaming',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:16379'
};

// PostgreSQL
const pool = new Pool({ connectionString: config.databaseUrl });

// Redis
const redis = new Redis(config.redisUrl);

// Evolution API Client
const evolutionApi = axios.create({
  baseURL: config.evolutionApiUrl,
  headers: {
    'apikey': config.evolutionApiKey
  }
});

// Schemas
const sendMessageSchema = z.object({
  phone: z.string().min(10),
  message: z.string().min(1),
  instance: z.string().default('default')
});

const bulkMessageSchema = z.object({
  phones: z.array(z.string().min(10)),
  message: z.string().min(1),
  instance: z.string().default('default'),
  delay: z.number().default(1000)
});

// Templates de mensagens
const messageTemplates = {
  registrationWelcome: (name) => `Olá ${name}! 👋 Bem-vindo ao nosso cassino online!`,
  depositReminder: (name, bonusInfo) =>
    `Hey ${name}! 💰 Não perca seu bônus de ${bonusInfo}. Faça seu primeiro depósito agora!`,
  betReminder: (name, lastActivity) =>
    `Olá ${name}! 🎰 Faz tempo que não te vemos por aqui (${lastActivity}). Voltou a jogar?`,
  winCelebration: (name, amount) =>
    `Parabéns ${name}! 🎉 Você ganhou ${amount}! Que sorte incrível!`,
  promotion: (name, promo) =>
    `${name}, oferta exclusiva para você! ${promo} 🚀`
};

// Funções
async function sendWhatsAppMessage(phone, message, instance = 'default') {
  try {
    const response = await evolutionApi.post(`/message/sendText/${instance}`, {
      number: phone,
      text: message
    });
    return { success: true, data: response.data };
  } catch (err) {
    fastify.log.error(`Failed to send message to ${phone}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendBulkMessages(phones, message, instance = 'default', delay = 1000) {
  const results = [];

  for (const phone of phones) {
    const result = await sendWhatsAppMessage(phone, message, instance);
    results.push({ phone, ...result });

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}

// Processar postbacks e acionar mensagens
async function processPostbackEvent(eventData) {
  const { event, userId, amount } = eventData;

  try {
    // Buscar dados do usuário
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];
    const phone = user.phone;

    // Evitar spam (mínimo 2h entre mensagens do mesmo tipo)
    const spamKey = `spam:${userId}:${event}`;
    const lastSent = await redis.get(spamKey);

    if (lastSent) return;

    // Enviar mensagem baseada no evento
    let message;
    switch (event) {
      case 'registration':
        message = messageTemplates.registrationWelcome(user.name);
        break;
      case 'deposit':
        message = messageTemplates.depositReminder(user.name, '100% até R$500');
        break;
      case 'bet':
        if (amount > 1000) {
          message = messageTemplates.winCelebration(user.name, `R$${amount}`);
        }
        break;
      case 'withdrawal':
        message = messageTemplates.promotion(user.name, 'Cashback de 10% na próxima aposta!');
        break;
    }

    if (message) {
      await sendWhatsAppMessage(phone, message);
      await redis.setex(spamKey, 7200, '1'); // 2h
      fastify.log.info(`WhatsApp sent: userId=${userId}, event=${event}`);
    }
  } catch (err) {
    fastify.log.error('Error processing postback event:', err);
  }
}

// Cron job - verificar leads não convertidos
cron.schedule('0 */4 * * *', async () => {
  fastify.log.info('Running lead recovery check...');

  try {
    const result = await pool.query(`
      SELECT u.* FROM users u
      LEFT JOIN postbacks p ON u.id = p.user_id AND p.event = 'deposit'
      WHERE p.id IS NULL
      AND u.created_at > NOW() - INTERVAL '7 days'
      AND u.phone IS NOT NULL
    `);

    for (const user of result.rows) {
      const spamKey = `recovery:${user.id}`;
      const lastSent = await redis.get(spamKey);

      if (!lastSent) {
        const message = messageTemplates.depositReminder(user.name, '100% no primeiro depósito!');
        await sendWhatsAppMessage(user.phone, message);
        await redis.setex(spamKey, 86400, '1'); // 24h
      }
    }
  } catch (err) {
    fastify.log.error('Lead recovery check failed:', err);
  }
});

// Inicialização
async function init() {
  await fastify.register(cors);

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }));

  // Enviar mensagem única
  fastify.post('/api/v1/send', async (request, reply) => {
    try {
      const data = sendMessageSchema.parse(request.body);
      const result = await sendWhatsAppMessage(data.phone, data.message, data.instance);
      return reply.code(200).send(result);
    } catch (err) {
      if (err.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors });
      }
      return reply.code(500).send({ error: err.message });
    }
  });

  // Enviar mensagens em massa
  fastify.post('/api/v1/send-bulk', async (request, reply) => {
    try {
      const data = bulkMessageSchema.parse(request.body);
      const results = await sendBulkMessages(data.phones, data.message, data.instance, data.delay);
      return reply.code(200).send({
        total: results.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      });
    } catch (err) {
      if (err.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors });
      }
      return reply.code(500).send({ error: err.message });
    }
  });

  // Listar templates
  fastify.get('/api/v1/templates', async () => ({
    templates: Object.keys(messageTemplates)
  }));

  // Usar template específico
  fastify.post('/api/v1/templates/:templateName', async (request, reply) => {
    const { templateName } = request.params;
    const { phone, params } = request.body;

    if (!messageTemplates[templateName]) {
      return reply.code(404).send({ error: 'Template not found' });
    }

    try {
      const message = messageTemplates[templateName](...params);
      const result = await sendWhatsAppMessage(phone, message);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Iniciar servidor
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  fastify.log.info(`WhatsApp service running on port ${config.port}`);
}

init().catch(err => {
  fastify.log.error(err);
  process.exit(1);
});
