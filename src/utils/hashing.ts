import { createHash } from 'crypto';

/**
 * Aplica hash SHA-256 nos dados do usuário para a Meta CAPI.
 * A Meta exige que campos de user_data sejam hasheados.
 */
export function hashValue(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Array de valores para serem hasheados individualmente.
 */
export function hashArray(values: string[]): string[] {
  return values.map(v => hashValue(v));
}

/**
 * Normaliza email: trim + lowercase antes do hash.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normaliza telefone: remove tudo que não é dígito.
 * Formato esperado pela Meta: 5511999999999 (código país + número).
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Se começar com 55 (Brasil) e tiver 13 dígitos, mantém
  // Se tiver 11 dígitos (sem código do país), adiciona 55
  if (digits.length === 11 && !digits.startsWith('55')) {
    return '55' + digits;
  }
  if (digits.length === 10 && !digits.startsWith('55')) {
    return '55' + digits;
  }
  return digits;
}

/**
 * Normaliza nome: trim + lowercase para hash.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Normaliza CEP: remove traços e espaços.
 */
export function normalizeZip(zip: string): string {
  return zip.replace(/[\s-]/g, '').trim();
}

/**
 * Normaliza cidade: trim + lowercase.
 */
export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/**
 * Normaliza estado/UF: trim + lowercase.
 */
export function normalizeState(state: string): string {
  return state.trim().toLowerCase();
}

/**
 * Normaliza país: converte para código ISO de 2 letras.
 */
export function normalizeCountry(country: string): string {
  const map: Record<string, string> = {
    brasil: 'br',
    brazil: 'br',
    argentina: 'ar',
    colombia: 'co',
    peru: 'pe',
    chile: 'cl',
    mexico: 'mx',
  };
  const lower = country.trim().toLowerCase();
  return map[lower] || lower.slice(0, 2);
}