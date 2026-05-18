import { Router, Request, Response } from 'express';
import { BetsalaPostback, MetaCapiEvent } from '../types';
import { MetaCapiService } from '../integrations/metaCapi';
import {
  validatePostback,
  mapEventType,
  generateEventId,
  buildUserData,
  buildCustomData,
  buildEventSourceUrl,
} from '../utils/normalization';
import { createLogger } from '../utils/logger';

const log = createLogger();

export function createPostbackRouter(metaCapi: MetaCapiService): Router {
  const router = Router();

  /**
   * POST /api/postback
   * Aceita parâmetros via query string ou body JSON.
   */
  router.post('/postback', async (req: Request, res: Response) => {
    await handlePostback(req, res);
  });

  /**
   * GET /api/postback
   * Betsala pode enviar postbacks via GET.
   */
  router.get('/postback', async (req: Request, res: Response) => {
    await handlePostback(req, res);
  });

  async function handlePostback(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    // Extrair parâmetros (query string para GET/POST, body para POST JSON)
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

    // Validar postback
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

    // Mapear tipo de evento
    const eventName = mapEventType(params.goal);
    if (!eventName) {
      log.warn({ goal: params.goal }, 'Tipo de evento desconhecido');
      res.status(400).json({
        status: 'error',
        message: `Tipo de evento desconhecido: ${params.goal}`,
      });
      return;
    }

    // Gerar event_id para deduplicação
    const eventId = params.event_id || generateEventId(params, params.goal || 'unknown');

    // Construir evento da Meta CAPI
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
    const result = await metaCapi.sendEvent(event);

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

    // Responder (sempre 200 para evitar retentativas da Betsala)
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