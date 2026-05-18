// ============================================================
// Betsala Postback - Parâmetros recebidos da plataforma de afiliados
// ============================================================
export interface BetsalaPostback {
  // Identificação
  event_id?: string;
  goal?: string;
  btag?: string;
  click_id?: string;
  user_id?: string;
  external_id?: string;

  // Transação
  amount?: string;
  currency?: string;
  revenue?: string;
  payout?: string;
  status?: string;
  transaction_id?: string;
  order_id?: string;
  payment?: string;

  // Usuário
  email?: string;
  phone?: string;
  name?: string;
  first_name?: string;
  last_name?: string;

  // Atribuição Facebook
  fbc?: string;
  fbp?: string;
  fbclid?: string;

  // Campanha
  campaign_id?: string;
  sub_id?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;

  // Segurança
  token?: string;
  signature?: string;
  hash?: string;
  auth_key?: string;
  verification?: string;
  sskey?: string;

  // Informações adicionais
  ip?: string;
  useragent?: string;
  country?: string;
  city?: string;
  region?: string;
  language?: string;
  device?: string;
  os?: string;
  browser?: string;
  carrier?: string;
  isp?: string;
  domain?: string;
  source?: string;
  tracker?: string;
}

// ============================================================
// Meta CAPI - Estruturas para envio à Conversions API
// ============================================================
export type BetsalaEventType = 'registration' | 'deposit' | 'cpa' | 'ftd';

export const BETSALA_EVENT_MAP: Record<string, MetaEventName> = {
  registration: 'CompleteRegistration',
  register: 'CompleteRegistration',
  deposit: 'Purchase',
  cpa: 'Lead',
  ftd: 'Subscribe',
  first_deposit: 'Subscribe',
};

export type MetaEventName =
  | 'CompleteRegistration'
  | 'Purchase'
  | 'Lead'
  | 'Subscribe'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'CustomEvent';

export interface MetaUserData {
  em?: string[];       // email (hashed)
  ph?: string[];       // phone (hashed)
  fn?: string[];       // first name (hashed)
  ln?: string[];       // last name (hashed)
  ct?: string[];       // city (hashed)
  st?: string[];       // state (hashed)
  zp?: string[];       // zip code (hashed)
  country?: string[];  // country (hashed)
  external_id?: string[];
  fbc?: string;
  fbp?: string;
  client_ip_address?: string;
  client_user_agent?: string;
}

export interface MetaCustomData {
  value?: number;
  currency?: string;
  content_name?: string;
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  status?: string;
  order_id?: string;
}

export interface MetaCapiEvent {
  event_name: MetaEventName;
  event_time: number;
  event_id: string;
  event_source_url?: string;
  action_source: 'website' | 'app' | 'offline';
  user_data: MetaUserData;
  custom_data?: MetaCustomData;
}

export interface MetaCapiRequest {
  data: MetaCapiEvent[];
  test_event_code?: string;
}

export interface MetaCapiResponse {
  events_received: number;
  messages?: Array<{
    id?: string;
    time?: number;
    message?: string;
    error?: number;
    error_data?: {
      reason?: string;
      message?: string;
    };
  }>;
  fbtrace_id?: string;
}

// ============================================================
// Configuração
// ============================================================
export interface AppConfig {
  port: number;
  meta: {
    pixelId: string;
    accessToken: string;
    apiVersion: string;
    testEventCode?: string;
  };
  postback: {
    securityToken?: string;
    allowedIps?: string[];
  };
  database: {
    url: string;
  };
  dedup: {
    ttlMinutes: number;
  };
  retry: {
    maxAttempts: number;
    baseDelayMs: number;
  };
  batch: {
    maxSize: number;
    flushIntervalMs: number;
  };
}

// ============================================================
// Resultados da aplicação
// ============================================================
export interface PostbackResult {
  received: boolean;
  eventId?: string;
  metaEventName?: string;
  metaEventId?: string;
  deduplicated?: boolean;
  sent?: boolean;
  metaResponse?: MetaCapiResponse;
  error?: string;
}

export type EventStatus = 'received' | 'validated' | 'deduplicated' | 'sent' | 'failed';
