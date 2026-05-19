-- ============================================================
-- Betsala → Meta CAPI — Schema do Banco de Dados
-- ============================================================

-- 1. Eventos recebidos da Betsala (postbacks)
CREATE TABLE IF NOT EXISTS postback_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255),
  goal VARCHAR(50),
  click_id VARCHAR(255),
  user_id VARCHAR(255),
  external_id VARCHAR(255),
  btag VARCHAR(255),
  amount NUMERIC(15, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  revenue NUMERIC(15, 2),
  payout NUMERIC(15, 2),
  status VARCHAR(50),
  transaction_id VARCHAR(255),
  order_id VARCHAR(255),
  email_hash VARCHAR(64),
  phone_hash VARCHAR(64),
  fbc VARCHAR(255),
  fbp VARCHAR(255),
  campaign_id VARCHAR(255),
  sub_id VARCHAR(255),
  sub1 VARCHAR(255),
  sub2 VARCHAR(255),
  sub3 VARCHAR(255),
  country VARCHAR(100),
  city VARCHAR(100),
  region VARCHAR(100),
  ip VARCHAR(45),
  user_agent TEXT,
  raw_params JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS goal VARCHAR(50);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS event_id VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS click_id VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS btag VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS revenue NUMERIC(15, 2);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS payout NUMERIC(15, 2);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS order_id VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS fbc VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS fbp VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS sub_id VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS sub1 VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS sub2 VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS sub3 VARCHAR(255);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS ip VARCHAR(45);
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE postback_events ADD COLUMN IF NOT EXISTS raw_params JSONB;

-- 2. Eventos enviados para Meta CAPI
CREATE TABLE IF NOT EXISTS meta_capi_events (
  id SERIAL PRIMARY KEY,
  postback_event_id INTEGER REFERENCES postback_events(id) ON DELETE SET NULL,
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  event_time BIGINT NOT NULL,
  action_source VARCHAR(20) DEFAULT 'website',
  user_data JSONB,
  custom_data JSONB,
  event_source_url TEXT,
  meta_request_body JSONB,
  meta_response_body JSONB,
  meta_status_code INTEGER,
  meta_fbtrace_id VARCHAR(255),
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  attempt_number INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Histórico de tentativas (retry)
CREATE TABLE IF NOT EXISTS retry_attempts (
  id SERIAL PRIMARY KEY,
  meta_event_id INTEGER REFERENCES meta_capi_events(id) ON DELETE CASCADE,
  postback_event_id INTEGER REFERENCES postback_events(id) ON DELETE SET NULL,
  event_id VARCHAR(255),
  attempt_number INTEGER NOT NULL,
  status_code INTEGER,
  response_body JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Cache de deduplicação (alternativa ao in-memory)
CREATE TABLE IF NOT EXISTS dedup_cache (
  id SERIAL PRIMARY KEY,
  dedup_key VARCHAR(512) NOT NULL UNIQUE,
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 5. Log de erros e alertas
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  event_id VARCHAR(255),
  error_code VARCHAR(50),
  error_message TEXT,
  stack_trace TEXT,
  meta_status_code INTEGER,
  payload JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Métricas diárias (resumo)
CREATE TABLE IF NOT EXISTS daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  goal VARCHAR(50),
  total_received INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_duplicates INTEGER DEFAULT 0,
  total_amount NUMERIC(20, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, goal, currency)
);

ALTER TABLE daily_metrics DROP CONSTRAINT IF EXISTS daily_metrics_date_currency_key;
ALTER TABLE daily_metrics DROP CONSTRAINT IF EXISTS daily_metrics_date_goal_currency_key;
ALTER TABLE daily_metrics ADD CONSTRAINT daily_metrics_date_goal_currency_key UNIQUE (date, goal, currency);

-- Índices
CREATE INDEX IF NOT EXISTS idx_postback_events_event_id ON postback_events(event_id);
CREATE INDEX IF NOT EXISTS idx_postback_events_goal ON postback_events(goal);
CREATE INDEX IF NOT EXISTS idx_postback_events_created_at ON postback_events(created_at);
CREATE INDEX IF NOT EXISTS idx_postback_events_click_id ON postback_events(click_id);
CREATE INDEX IF NOT EXISTS idx_postback_events_user_id ON postback_events(user_id);

CREATE INDEX IF NOT EXISTS idx_meta_capi_events_event_id ON meta_capi_events(event_id);
CREATE INDEX IF NOT EXISTS idx_meta_capi_events_event_name ON meta_capi_events(event_name);
CREATE INDEX IF NOT EXISTS idx_meta_capi_events_success ON meta_capi_events(success);
CREATE INDEX IF NOT EXISTS idx_meta_capi_events_created_at ON meta_capi_events(created_at);

CREATE INDEX IF NOT EXISTS idx_dedup_cache_dedup_key ON dedup_cache(dedup_key);
CREATE INDEX IF NOT EXISTS idx_dedup_cache_expires_at ON dedup_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
CREATE INDEX IF NOT EXISTS idx_error_logs_acknowledged ON error_logs(acknowledged);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);