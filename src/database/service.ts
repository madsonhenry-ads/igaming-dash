import { createHash } from 'crypto';
import { query } from './connection';
import { BetsalaPostback, PostbackResult, MetaCapiEvent, MetaCapiResponse } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger();

export class DatabaseService {
  async initialize() {
    // Tabelas já criadas via migration
    log.info('DatabaseService inicializado');
  }

  /**
   * Insere um postback recebido da Betsala.
   */
  async insertPostback(params: BetsalaPostback): Promise<number> {
    const {
      event_id, goal, click_id, user_id, external_id, btag,
      amount, currency, revenue, payout, status,
      transaction_id, order_id, email, phone,
      fbc, fbp, campaign_id, sub_id, sub1, sub2, sub3,
      country, city, region, ip, useragent,
    } = params;

    const result = await query(
      `INSERT INTO postback_events (
        event_id, goal, click_id, user_id, external_id, btag,
        amount, currency, revenue, payout, status,
        transaction_id, order_id, email_hash, phone_hash,
        fbc, fbp, campaign_id, sub_id, sub1, sub2, sub3,
        country, city, region, ip, user_agent, raw_params
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING id`,
      [
        event_id, goal, click_id, user_id, external_id, btag,
        amount ? parseFloat(amount) : null, currency || 'USD',
        revenue ? parseFloat(revenue) : null, payout ? parseFloat(payout) : null,
        status, transaction_id, order_id,
        email ? createHash('sha256').update(email.trim().toLowerCase()).digest('hex') : null,
        phone ? createHash('sha256').update(phone.replace(/\D/g, '')).digest('hex') : null,
        fbc, fbp, campaign_id, sub_id, sub1, sub2, sub3,
        country, city, region, ip || null, useragent || null,
        JSON.stringify(params),
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Registra o envio de um evento para Meta CAPI.
   */
  async insertMetaEvent(
    postbackEventId: number,
    event: MetaCapiEvent,
    success: boolean,
    result: PostbackResult,
    requestBody: any,
    attempt: number = 1
  ): Promise<number> {
    const metaResponse = result.metaResponse;
    const statusCode = metaResponse?.messages?.[0]?.error ? undefined : 200;

    const dbResult = await query(
      `INSERT INTO meta_capi_events (
        postback_event_id, event_id, event_name, event_time, action_source,
        user_data, custom_data, event_source_url,
        meta_request_body, meta_response_body, meta_status_code,
        meta_fbtrace_id, success, error_message, attempt_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        postbackEventId,
        event.event_id,
        event.event_name,
        event.event_time,
        event.action_source,
        JSON.stringify(event.user_data),
        JSON.stringify(event.custom_data),
        event.event_source_url,
        JSON.stringify(requestBody),
        JSON.stringify(metaResponse),
        statusCode,
        metaResponse?.fbtrace_id,
        result.sent ?? false,
        result.error || null,
        attempt,
      ]
    );

    // Se falhou, registra em error_logs
    if (!result.sent) {
      await this.insertErrorLog(
        'meta_capi',
        event.event_id,
        result.error || 'Unknown error',
        statusCode,
        requestBody
      );
    }

    return dbResult.rows[0].id;
  }

  /**
   * Registra uma tentativa de retry.
   */
  async insertRetryAttempt(
    metaEventId: number,
    postbackEventId: number,
    eventId: string | undefined,
    attempt: number,
    statusCode: number | undefined,
    responseBody: any,
    errorMessage?: string,
    durationMs?: number
  ) {
    await query(
      `INSERT INTO retry_attempts (
        meta_event_id, postback_event_id, event_id, attempt_number,
        status_code, response_body, error_message, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        metaEventId, postbackEventId, eventId, attempt,
        statusCode, JSON.stringify(responseBody), errorMessage, durationMs,
      ]
    );
  }

  /**
   * Verifica se um evento já foi processado (deduplicação via banco).
   */
  async isDuplicate(eventId: string, eventName: string, ttlMinutes: number): Promise<boolean> {
    const result = await query(
      `SELECT id FROM dedup_cache
       WHERE dedup_key = $1 AND expires_at > NOW()
       LIMIT 1`,
      [`${eventName}_${eventId}`]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Marca um evento como processado na tabela de deduplicação.
   */
  async markDeduplicated(eventId: string, eventName: string, ttlMinutes: number) {
    await query(
      `INSERT INTO dedup_cache (dedup_key, event_id, event_name, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 minute' * $4)
       ON CONFLICT (dedup_key) DO NOTHING`,
      [`${eventName}_${eventId}`, eventId, eventName, ttlMinutes]
    );
  }

  /**
   * Registra um erro no log de erros.
   */
  async insertErrorLog(
    source: string,
    eventId?: string,
    errorMessage?: string,
    statusCode?: number,
    payload?: any
  ) {
    await query(
      `INSERT INTO error_logs (source, event_id, error_message, meta_status_code, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [source, eventId, errorMessage, statusCode, payload ? JSON.stringify(payload) : null]
    );
  }

  /**
   * Atualiza métricas diárias.
   */
  async updateDailyMetrics(
    goal: string | undefined,
    sent: boolean | undefined,
    duplicate: boolean | undefined,
    amount?: number,
    currency?: string
  ) {
    const today = new Date().toISOString().split('T')[0];

    if (duplicate) {
      await query(
        `INSERT INTO daily_metrics (date, goal, total_duplicates, currency)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (date, goal, currency)
         DO UPDATE SET total_duplicates = daily_metrics.total_duplicates + 1`,
        [today, goal || 'unknown', currency || 'USD']
      );
      return;
    }

    await query(
      `INSERT INTO daily_metrics (date, goal, total_received, total_sent, total_failed, total_amount, currency)
       VALUES ($1, $2, 1, $3, $4, $5, $6)
       ON CONFLICT (date, goal, currency)
       DO UPDATE SET
         total_received = daily_metrics.total_received + 1,
         total_sent = daily_metrics.total_sent + $7,
         total_failed = daily_metrics.total_failed + $8,
         total_amount = daily_metrics.total_amount + $9`,
      [
        today, goal || 'unknown',
        sent ? 1 : 0, sent ? 0 : 1,
        amount || 0, currency || 'USD',
        sent ? 1 : 0, sent ? 0 : 1, amount || 0,
      ]
    );
  }

  /**
   * Retorna estatísticas para health check.
   */
  async getStats() {
    const totals = await query(
      `SELECT
        (SELECT COUNT(*) FROM postback_events) AS total_postbacks,
        (SELECT COUNT(*) FROM meta_capi_events WHERE success = TRUE) AS total_sent,
        (SELECT COUNT(*) FROM meta_capi_events WHERE success = FALSE) AS total_failed,
        (SELECT COUNT(*) FROM error_logs WHERE acknowledged = FALSE) AS pending_errors,
        (SELECT COUNT(*) FROM postback_events WHERE created_at >= NOW() - INTERVAL '24 hours') AS last_24h
      `
    );
    return totals.rows[0];
  }
}

export const databaseService = new DatabaseService();