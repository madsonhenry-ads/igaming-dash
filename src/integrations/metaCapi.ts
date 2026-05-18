import { MetaCapiEvent, MetaCapiRequest, MetaCapiResponse, PostbackResult, AppConfig } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger();

/**
 * Serviço de envio de eventos para a Meta Conversions API (CAPI).
 * Responsável por: envio, retentativas, deduplicação e batching.
 */
export class MetaCapiService {
  private readonly baseUrl: string;
  private readonly config: AppConfig;
  private readonly sentEvents: Map<string, number> = new Map(); // eventId -> timestamp

  constructor(config: AppConfig) {
    this.config = config;
    this.baseUrl = `https://graph.facebook.com/${config.meta.apiVersion}/${config.meta.pixelId}/events`;
  }

  /**
   * Verifica se um evento já foi enviado (deduplicação).
   */
  isDuplicate(eventId: string, eventName: string): boolean {
    const key = `${eventName}_${eventId}`;
    const sentAt = this.sentEvents.get(key);
    if (!sentAt) return false;

    const ttlMs = this.config.dedup.ttlMinutes * 60 * 1000;
    const isExpired = Date.now() - sentAt > ttlMs;

    if (isExpired) {
      this.sentEvents.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Marca um evento como enviado (para deduplicação).
   */
  markSent(eventId: string, eventName: string): void {
    const key = `${eventName}_${eventId}`;
    this.sentEvents.set(key, Date.now());

    // Limpeza periódica: se estiver grande, limpa entradas expiradas
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
  async sendEvent(event: MetaCapiEvent, attempt: number = 1): Promise<PostbackResult> {
    const result: PostbackResult = {
      received: true,
      eventId: event.event_id,
      metaEventName: event.event_name,
      metaEventId: event.event_id,
    };

    // Verificar duplicata
    if (this.isDuplicate(event.event_id, event.event_name)) {
      log.info({ eventId: event.event_id, eventName: event.event_name }, 'Evento duplicado ignorado');
      result.deduplicated = true;
      result.sent = true;
      return result;
    }

    try {
      const body: MetaCapiRequest = { data: [event] };

      // Se existir código de teste, adiciona
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

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as MetaCapiResponse;

      if (!response.ok) {
        const errorMsg = data.messages?.[0]?.message || response.statusText;
        const errorCode = data.messages?.[0]?.error || response.status;

        log.error(
          { eventId: event.event_id, statusCode: response.status, error: errorMsg, errorCode },
          'Erro da Meta CAPI'
        );

        // Decidir se retenta baseado no erro
        if (this.shouldRetry(response.status, errorCode)) {
          if (attempt < this.config.retry.maxAttempts) {
            const delay = this.config.retry.baseDelayMs * Math.pow(2, attempt - 1);
            log.info(
              { eventId: event.event_id, attempt, nextDelay: delay },
              'Retentando envio para Meta CAPI'
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.sendEvent(event, attempt + 1);
          }
        }

        result.sent = false;
        result.error = errorMsg;
        result.metaResponse = data;
        return result;
      }

      // Sucesso
      this.markSent(event.event_id, event.event_name);
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

      // Retentar em erros de conexão/network
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
    // Erros 5xx e de conexão podem ser retentados
    if (httpStatus >= 500) return true;
    // Rate limit (429) pode ser retentado
    if (httpStatus === 429) return true;
    // Erros específicos da API Meta: rate limit, temporary
    if (apiErrorCode === 4 || apiErrorCode === 17 || apiErrorCode === 80004) return true;
    // Erros 4xx de validação NÃO devem ser retentados
    return false;
  }

  /**
   * Envia múltiplos eventos em lote (batch).
   */
  async sendBatch(events: MetaCapiEvent[]): Promise<PostbackResult[]> {
    const results: PostbackResult[] = [];

    // Processar em lotes do tamanho máximo permitido
    for (let i = 0; i < events.length; i += this.config.batch.maxSize) {
      const batch = events.slice(i, i + this.config.batch.maxSize);

      // Enviar eventos individualmente (para maior controle de erro)
      for (const event of batch) {
        const result = await this.sendEvent(event);
        results.push(result);
      }
    }

    return results;
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