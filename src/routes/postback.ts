import { Router, Request, Response } from 'express';
import { BetsalaPostback, MetaCapiEvent } from '../types';
import { MetaCapiService } from '../integrations/metaCapi';
import { DatabaseService } from '../database/service';
import {
  validatePostback,
  mapEventType,
  generateEventId,
  buildUserData,
  buildCustomData,
  buildEventSourceUrl,
  extractValue,
} from '../utils/normalization';
import { createLogger } from '../utils/logger';

const log = createLogger();

export function createPostbackRouter(metaCapi: MetaCapiService, db: DatabaseService): Router {
  const router = Router();

  /**
   * POST /api/postback
   */
  router.post('/postback', async (req: Request, res: Response) => {
    await handlePostback(req, res);
  });

  /**
   * GET /api/postback
   */
  router.get('/postback', async (req: Request, res: Response) => {
    await handlePostback(req, res);
  });

  async function handlePostback(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const params: BetsalaPostback = { ...req.query, ...req.body };

    log.info(
      {
        goal: params.goal,
        event_id: params.event_id,
        click_id: params.click_id,
        user_id: params.user_id,
        hasEmail: !!params.email,
        hasPhone: !!params.phone,
      },
      'Postback recebido'
    );

    // Validar
    const validation = validatePostback(params);
    if (!validation.valid) {
      log.warn({ errors: validation.errors }, 'Postback inválido');
      res.status(422).json({
        status: 'error',
        message: 'Dados inválidos',
        errors: validation.errors,
      });
      return;
    }

    // Mapear evento
    const eventName = mapEventType(params.goal);
    if (!eventName) {
      log.warn({ goal: params.goal }, 'Tipo de evento desconhecido');
      res.status(400).json({
        status: 'error',
        message: `Tipo de evento desconhecido: ${params.goal}`,
      });
      return;
    }

    // Gerar event_id
    const eventId = params.event_id || generateEventId(params, params.goal || 'unknown');

    // Salvar no banco
    let postbackDbId: number | undefined;
    try {
      postbackDbId = await db.insertPostback(params);
    } catch (dbError) {
      log.warn({ error: dbError }, 'Erro ao salvar postback no banco (não crítico)');
    }

    // Construir evento Meta CAPI
    const event: MetaCapiEvent = {
      event_name: eventName,
      event_time: Math.floor(startTime / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: buildEventSourceUrl(params) || req.headers.referer || undefined,
      user_data: buildUserData(params, req.ip, req.headers['user-agent']),
      custom_data: buildCustomData(params, eventName),
    };

    // Enviar para Meta CAPI
    const result = await metaCapi.sendEvent(event, 1, postbackDbId);

    // Registrar no meta_capi_events
    if (postbackDbId) {
      try {
        await db.insertMetaEvent(postbackDbId, event, result.sent ?? false, result, event);
      } catch (dbError) {
        log.warn({ error: dbError }, 'Erro ao salvar meta event no banco');
      }
    }

    // Atualizar métricas
    try {
      const value = extractValue(params);
      await db.updateDailyMetrics(
        params.goal,
        result.sent,
        result.deduplicated,
        value,
        params.currency
      );
    } catch (dbError) {
      log.warn({ error: dbError }, 'Erro ao atualizar métricas');
    }

    // Log do resultado
    const duration = Date.now() - startTime;
    log.info(
      {
        eventId: result.metaEventId,
        eventName: result.metaEventName,
        sent: result.sent,
        deduplicated: result.deduplicated,
        durationMs: duration,
        error: result.error,
      },
      'Postback processado'
    );

    // Responder sempre 200
    res.status(200).json({
      status: 'received',
      event_id: eventId,
      meta_event: eventName,
      sent: result.sent,
      deduplicated: result.deduplicated,
      error: result.error || undefined,
    });
  }

  return router;
}