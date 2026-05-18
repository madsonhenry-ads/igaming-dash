import { BetsalaPostback, BetsalaEventType, MetaEventName, BETSALA_EVENT_MAP } from '../types';
import { hashValue, normalizeEmail, normalizePhone, normalizeName, normalizeZip, normalizeCity, normalizeState, normalizeCountry } from './hashing';

/**
 * Mapeia o evento da Betsala para o event_name da Meta CAPI.
 */
export function mapEventType(goal: string | undefined): MetaEventName | null {
  if (!goal) return null;
  const lower = goal.trim().toLowerCase();
  return BETSALA_EVENT_MAP[lower] ?? null;
}

/**
 * Extrai o valor numérico de um postback (amount, revenue, payout).
 */
export function extractValue(postback: BetsalaPostback): number | undefined {
  const val = postback.amount || postback.revenue || postback.payout;
  if (!val) return undefined;
  const num = parseFloat(val);
  return isNaN(num) ? undefined : num;
}

/**
 * Extrai a moeda do postback.
 */
export function extractCurrency(postback: BetsalaPostback): string | undefined {
  return postback.currency || 'USD';
}

/**
 * Gera um event_id único para deduplicação.
 * Formato: {player_id}_{event_type}_{timestamp}
 */
export function generateEventId(postback: BetsalaPostback, eventType: string): string {
  const playerId = postback.user_id || postback.external_id || postback.click_id || 'unknown';
  const ts = Math.floor(Date.now() / 1000);
  return `betsala_${playerId}_${eventType}_${ts}`;
}

/**
 * Valida se os campos obrigatórios do postback estão presentes.
 */
export function validatePostback(postback: BetsalaPostback): { valid: boolean; errors: string[] } {
  const erros: string[] = [];

  // Precisa de pelo menos um identificador de evento
  if (!postback.goal && !postback.event_id) {
    erros.push('Campo obrigatório ausente: goal ou event_id');
  }

  // Precisa de pelo menos um dado de usuário para matching na Meta CAPI
  if (!postback.email && !postback.phone && !postback.fbc && !postback.fbp) {
    erros.push('É necessário pelo menos um dado de usuário: email, phone, fbc ou fbp');
  }

  return { valid: erros.length === 0, errors: erros };
}

/**
 * Constrói o objeto user_data para a Meta CAPI a partir do postback.
 * Aplica hash SHA-256 conforme exigido pela Meta.
 */
export function buildUserData(postback: BetsalaPostback, clientIp?: string, userAgent?: string) {
  const userData: any = {};

  // Campos com hash
  if (postback.email) userData.em = [hashValue(normalizeEmail(postback.email))];
  if (postback.phone) userData.ph = [hashValue(normalizePhone(postback.phone))];

  // Nome pode vir de várias formas
  const firstName = postback.first_name || postback.name?.split(' ')[0];
  const lastName = postback.last_name || postback.name?.split(' ').slice(1).join(' ');
  if (firstName) userData.fn = [hashValue(normalizeName(firstName))];
  if (lastName) userData.ln = [hashValue(normalizeName(lastName))];

  // Dados de localização
  if (postback.city) userData.ct = [hashValue(normalizeCity(postback.city))];
  if (postback.region) userData.st = [hashValue(normalizeState(postback.region))];
  if (postback.country) userData.country = [hashValue(normalizeCountry(postback.country))];

  // IDs de atribuição (NÃO usar sem hash - a Meta espera sem hash para fbc/fbp )
  if (postback.fbc) userData.fbc = postback.fbc;
  if (postback.fbp) userData.fbp = postback.fbp;

  // IDs externos com hash
  const externalId = postback.external_id || postback.user_id;
  if (externalId) userData.external_id = [hashValue(externalId)];

  // Dados de contexto
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;

  return userData;
}

/**
 * Constrói o objeto custom_data para a Meta CAPI.
 */
export function buildCustomData(postback: BetsalaPostback, eventType: MetaEventName) {
  const value = extractValue(postback);
  const currency = extractCurrency(postback);

  const customData: any = {};

  if (value !== undefined) customData.value = value;
  if (currency) customData.currency = currency;
  if (postback.status) customData.status = postback.status;
  if (postback.transaction_id || postback.order_id) {
    customData.order_id = postback.transaction_id || postback.order_id;
  }

  // Para eventos de depósito/compra, incluir content_name
  if (eventType === 'Purchase') {
    customData.content_name = 'deposit';
    customData.content_type = 'product';
  }

  return customData;
}

/**
 * Constrói a URL de origem do evento.
 */
export function buildEventSourceUrl(postback: BetsalaPostback): string | undefined {
  if (postback.domain) {
    return `https://${postback.domain}`;
  }
  return undefined;
}