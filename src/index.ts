import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loadConfig, AppConfig } from './config';
import { MetaCapiService } from './integrations/metaCapi';
import { createPostbackRouter } from './routes/postback';
import { createSecurityMiddleware } from './middleware/validation';
import { createLogger } from './utils/logger';

const log = createLogger();

async function main() {
  try {
    // Carregar configuração
    log.info('Inicializando servidor...');
    const config: AppConfig = loadConfig();

    // Inicializar serviços
    const metaCapi = new MetaCapiService(config);

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
    app.get('/health', (_req, res) => {
      const stats = metaCapi.getStats();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        meta: stats,
      });
    });

    // Rotas da API
    const securityMiddleware = createSecurityMiddleware(config);
    app.use('/api', securityMiddleware, createPostbackRouter(metaCapi));

    // Tratamento de rotas não encontradas
    app.use((_req, res) => {
      res.status(404).json({ error: 'Rota não encontrada' });
    });

    // Tratamento global de erros
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      log.error({ error: err.message, stack: err.stack }, 'Erro interno do servidor');
      res.status(500).json({ error: 'Erro interno do servidor' });
    });

    // Iniciar servidor
    const server = app.listen(config.port, () => {
      log.info(`Servidor rodando na porta ${config.port}`);
      log.info(`Health check: http://localhost:${config.port}/health`);
      log.info(`Postback endpoint: http://localhost:${config.port}/api/postback`);
      log.info(`Pixel ID: ${config.meta.pixelId}`);
      log.info(`Meta API: ${config.meta.apiVersion}`);
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
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Erro ao iniciar servidor');
    process.exit(1);
  }
}

main();