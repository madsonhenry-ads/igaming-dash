import { MetaCapiEvent, MetaCapiRequest, MetaCapiResponse, PostbackResult, AppConfig } from '../types';
import { DatabaseService } from '../database/service';
import { createLogger } from '../utils/logger';

const log = createLogger();

/**
 * Serviço de envio de eventos para a Meta Conversions API (CAPI).
 * Responsável por: envio, retentativas, deduplicação e batching.
 */
export class MetaCapiService {
  private readonly baseUrl: string;
  private readonly config: AppConfig;
  private readonly db: DatabaseService;
  private readonly sentEvents: Map<string, number> = new Map(); // cache in-memory

  constructor(config: AppConfig, db: DatabaseService) {
    this.config = config;
    this.db = db;
    this.baseUrl = `https://graph.facebook.com/${config.meta.apiVersion}/${config.meta.pixelId}/events`;
  }

  /**
   * Verifica se um evento já foi enviado (deduplicação).
   * Primeiro verifica cache in-memory, depois banco de dados.
   */
  async isDuplicate(eventId: string, eventName: string): Promise<boolean> {
    const key = `${eventName}_${eventId}`;

    // Verificar cache in-memory primeiro
    const sentAt = this.sentEvents.get(key);
    if (sentAt) {
      if (Date.now() - sentAt <= this.config.dedup.ttlMinutes * 60 * 1000) {
        return true;
      }
      this.sentEvents.delete(key);
    }

    // Verificar no banco de dados
    try {
      return await this.db.isDuplicate(eventId, eventName, this.config.dedup.ttlMinutes);
    } catch {
      // Se banco falhar, usa só memoria
      return false;
    }
  }

  /**
   * Marca um evento como enviado (para deduplicação).
   */
  async markSent(eventId: string, eventName: string): Promise<void> {
    const key = `${eventName}_${eventId}`;
    this.sentEvents.set(key, Date.now());

    // Marcar também no banco
    try {
      await this.db.markDeduplicated(eventId, eventName, this.config.dedup.ttlMinutes);
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.message : String(err) }, 'Erro ao salvar dedup no banco');
    }

    // Limpeza periódica do cache in-memory
    if (this.sentEvents.size > 10000) {
      this.cleanExpired();
    }
  }

  /**
   * Remove entradas expiradas do mapa de deduplicação.
   */
  private cleanExpired(): void {
    const ttlMs = this.config.dedup.ttlMinutes * 60 * 1000;
    const now = Date.now();
    for (const [key, timestamp] of this.sentEvents.entries()) {
      if (now - timestamp > ttlMs) {
        this.sentEvents.delete(key);
      }
    }
  }

  /**
   * Envia um único evento para a Meta CAPI com retry.
   */
  async sendEvent(event: MetaCapiEvent, attempt: number = 1, postbackEventId?: number): Promise<PostbackResult> {
    // Se vier com postbackEventId e for a primeira chamada, registra no banco ao final
    const result: PostbackResult = {
      received: true,
      eventId: event.event_id,
      metaEventName: event.event_name,
      metaEventId: event.event_id,
    };

    // Verificar duplicata
    if (await this.isDuplicate(event.event_id, event.event_name)) {
      log.info({ eventId: event.event_id, eventName: event.event_name }, 'Evento duplicado ignorado');
      result.deduplicated = true;
      result.sent = true;
      return result;
    }

    try {
      const body: MetaCapiRequest = { data: [event] };

      if (this.config.meta.testEventCode) {
        body.test_event_code = this.config.meta.testEventCode;
      }

      const params = new URLSearchParams({
        access_token: this.config.meta.accessToken,
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      log.info(
        { eventId: event.event_id, eventName: event.event_name, attempt },
        'Enviando evento para Meta CAPI'
      );

      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const duration = Date.now() - startTime;

      const data = (await response.json()) as MetaCapiResponse;

      if (!response.ok) {
        const errorMsg = data.messages?.[0]?.message || response.statusText;
        const errorCode = data.messages?.[0]?.error || response.status;

        log.error(
          { eventId: event.event_id, statusCode: response.status, error: errorMsg, errorCode },
          'Erro da Meta CAPI'
        );

        // Registrar tentativa no banco
        if (postbackEventId) {
          try {
            await this.db.insertRetryAttempt(
              0, postbackEventId, event.event_id, attempt,
              response.status, data, errorMsg, duration
            );
          } catch (dbErr) {
            log.warn({ error: dbErr }, 'Erro ao salvar retry attempt no banco');
          }
        }

        // Decidir se retenta
        if (this.shouldRetry(response.status, errorCode)) {
          if (attempt < this.config.retry.maxAttempts) {
            const delay = this.config.retry.baseDelayMs * Math.pow(2, attempt - 1);
            log.info(
              { eventId: event.event_id, attempt, nextDelay: delay },
              'Retentando envio para Meta CAPI'
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.sendEvent(event, attempt + 1, postbackEventId);
          }
        }

        result.sent = false;
        result.error = errorMsg;
        result.metaResponse = data;
        return result;
      }

      // Sucesso
      await this.markSent(event.event_id, event.event_name);
      result.sent = true;
      result.metaResponse = data;

      log.info(
        { eventId: event.event_id, eventName: event.event_name, eventsReceived: data.events_received },
        'Evento enviado com sucesso para Meta CAPI'
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      log.error(
        { eventId: event.event_id, error: errorMessage, attempt },
        'Erro de conexão ao enviar para Meta CAPI'
      );

      if (attempt < this.config.retry.maxAttempts) {
        const delay = this.config.retry.baseDelayMs * Math.pow(2, attempt - 1);
        log.info(
          { eventId: event.event_id, attempt, nextDelay: delay },
          'Retentando após erro de conexão'
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendEvent(event, attempt + 1);
      }

      result.sent = false;
      result.error = errorMessage;
      return result;
    }
  }

  /**
   * Decide se deve retentar baseado no código de erro HTTP/API.
   */
  private shouldRetry(httpStatus: number, apiErrorCode?: number): boolean {
    if (httpStatus >= 500) return true;
    if (httpStatus === 429) return true;
    if (apiErrorCode === 4 || apiErrorCode === 17 || apiErrorCode === 80004) return true;
    return false;
  }

  /**
   * Envia múltiplos eventos em lote (batch).
   */
  async sendBatch(events: MetaCapiEvent[]): Promise<PostbackResult[]> {
    const results: PostbackResult[] = [];

    for (let i = 0; i < events.length; i += this.config.batch.maxSize) {
      const batch = events.slice(i, i + this.config.batch.maxSize);
      for (const event of batch) {
        const result = await this.sendEvent(event);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Método público para enviar evento com postbackEventId
   */
  async sendEventWithPostbackId(
    event: MetaCapiEvent,
    postbackEventId: number
  ): Promise<PostbackResult> {
    return this.sendEvent(event, 1, postbackEventId);
  }

  /**
   * Retorna estatísticas do serviço para health check.
   */
  getStats() {
    return {
      dedupCacheSize: this.sentEvents.size,
      pixelId: this.config.meta.pixelId,
      apiVersion: this.config.meta.apiVersion,
    };
  }
}