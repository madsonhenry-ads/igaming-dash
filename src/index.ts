import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loadConfig, AppConfig } from './config';
import { MetaCapiService } from './integrations/metaCapi';
import { createPostbackRouter } from './routes/postback';
import { createSecurityMiddleware } from './middleware/validation';
import { createLogger } from './utils/logger';
import { runMigrations } from './database/migrations';
import { databaseService } from './database/service';

const log = createLogger();

async function main() {
  let config: AppConfig | null = null;
  let metaCapi: MetaCapiService | null = null;
  const db = databaseService;
  let startupError: any = null;
  let isInitialized = false;

  // Criar app Express
  const app = express();

  // Middlewares globais
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Middleware de logging de requisições
  app.use((req, _res, next) => {
    log.debug(
      { method: req.method, path: req.path, ip: req.ip },
      `${req.method} ${req.path}`
    );
    next();
  });

  // Health check
  app.get('/health', async (_req, res) => {
    let dbStats: any = { connected: false };
    if (isInitialized && db) {
      try {
        dbStats = await db.getStats();
        dbStats.connected = true;
      } catch (e) {
        dbStats.connected = false;
        dbStats.error = e instanceof Error ? e.message : String(e);
      }
    }
    res.json({
      status: startupError ? 'error' : (isInitialized ? 'ok' : 'initializing'),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      startupError: startupError ? (startupError.message || String(startupError)) : null,
      meta: metaCapi ? metaCapi.getStats() : null,
      database: dbStats,
    });
  });

  // Rotas da API dinâmicas (aguarda inicialização)
  app.use('/api', (req, res, next) => {
    if (startupError) {
      return res.status(500).json({
        status: 'error',
        message: 'Servidor falhou na inicialização',
        error: startupError.message || String(startupError)
      });
    }
    if (!isInitialized || !config || !metaCapi) {
      return res.status(503).json({
        status: 'error',
        message: 'Servidor ainda está inicializando...'
      });
    }
    const securityMiddleware = createSecurityMiddleware(config);
    const router = createPostbackRouter(metaCapi, db);
    securityMiddleware(req, res, () => router(req, res, next));
  });

  // Rota raiz
  app.get('/', (_req, res) => {
    res.json({
      service: 'Betsala → Meta CAPI',
      version: '1.0.0',
      status: startupError ? 'error' : (isInitialized ? 'running' : 'initializing'),
      startupError: startupError ? (startupError.message || String(startupError)) : null,
      docs: {
        health: '/health',
        postback: '/api/postback',
      },
    });
  });

  // Tratamento de rotas não encontradas
  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  // Tratamento global de erros
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.error({ error: err.message, stack: err.stack }, 'Erro interno do servidor');
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  // Porta da variável de ambiente ou 3000 padrão
  const port = parseInt(process.env.PORT || '3000', 10);

  // Iniciar servidor imediatamente
  const server = app.listen(port, () => {
    log.info(`Servidor rodando na porta ${port}`);
    log.info(`Health check: http://localhost:${port}/health`);

    // Inicialização assíncrona em segundo plano
    (async () => {
      try {
        log.info('Carregando configuração...');
        config = loadConfig();

        log.info('Executando migrações do banco de dados...');
        await runMigrations();

        log.info('Inicializando Meta CAPI Service...');
        metaCapi = new MetaCapiService(config, db);

        isInitialized = true;
        log.info('Servidor inicializado e pronto para tráfego');
      } catch (err: any) {
        startupError = err;
        log.error({ error: err.message || String(err), stack: err.stack }, 'Erro ao iniciar os serviços do servidor');
      }
    })();
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    log.info(`Recebido sinal ${signal}, encerrando servidor...`);
    server.close(() => {
      log.info('Servidor encerrado');
      process.exit(0);
    });
    // Forçar encerramento após 10s
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();