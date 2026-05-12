-- DASH-IGAMING Database Schema (Combined with Refferq)

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- REFFERQ CORE TABLES (simplified)
-- ============================================

-- Users (Dashboard)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'AFFILIATE',
  status VARCHAR(50) DEFAULT 'PENDING',
  last_login TIMESTAMP,
  profile_picture VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Affiliates
CREATE TABLE IF NOT EXISTS affiliates (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  referral_code VARCHAR(255) UNIQUE NOT NULL,
  payout_details JSONB DEFAULT '{}',
  balance_cents INTEGER DEFAULT 0,
  partner_group_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX idx_affiliates_referral_code ON affiliates(referral_code);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id VARCHAR(255) PRIMARY KEY,
  affiliate_id VARCHAR(255) NOT NULL,
  lead_name VARCHAR(255) NOT NULL,
  lead_email VARCHAR(255) NOT NULL,
  lead_phone VARCHAR(20),
  subscription_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_referrals_affiliate_id ON referrals(affiliate_id);
CREATE INDEX idx_referrals_status ON referrals(status);

-- Referral Clicks
CREATE TABLE IF NOT EXISTS referral_clicks (
  id VARCHAR(255) PRIMARY KEY,
  referral_id VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  referer TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_referral_clicks_referral_id ON referral_clicks(referral_id);

-- Conversions
CREATE TABLE IF NOT EXISTS conversions (
  id VARCHAR(255) PRIMARY KEY,
  affiliate_id VARCHAR(255) NOT NULL,
  referral_id VARCHAR(255),
  event_type VARCHAR(50) NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'PENDING',
  event_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversions_affiliate_id ON conversions(affiliate_id);
CREATE INDEX idx_conversions_status ON conversions(status);

-- Commissions
CREATE TABLE IF NOT EXISTS commissions (
  id VARCHAR(255) PRIMARY KEY,
  conversion_id VARCHAR(255) NOT NULL,
  affiliate_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  amount_cents INTEGER NOT NULL,
  rate DECIMAL(5, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  paid_at TIMESTAMP,
  matures_at TIMESTAMP,
  clawback_note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  payout_id VARCHAR(255)
);

CREATE INDEX idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX idx_commissions_status ON commissions(status);

-- Payouts
CREATE TABLE IF NOT EXISTS payouts (
  id VARCHAR(255) PRIMARY KEY,
  affiliate_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  amount_cents INTEGER NOT NULL,
  commission_count INTEGER DEFAULT 0,
  method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'PENDING',
  notes TEXT,
  processed_at TIMESTAMP,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payouts_affiliate_id ON payouts(affiliate_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- ============================================
-- iGAMING SPECIFIC TABLES
-- ============================================

-- Postback Events (S2S)
CREATE TABLE IF NOT EXISTS postback_events (
  id VARCHAR(255) PRIMARY KEY,
  click_id VARCHAR(255) NOT NULL,
  event VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'BRL',
  timestamp TIMESTAMP NOT NULL,
  user_id VARCHAR(255),
  ip VARCHAR(45),
  affiliate_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'PENDING',
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_postback_click_id ON postback_events(click_id);
CREATE INDEX idx_postback_event ON postback_events(event);
CREATE INDEX idx_postback_user_id ON postback_events(user_id);
CREATE INDEX idx_postback_affiliate_id ON postback_events(affiliate_id);
CREATE UNIQUE INDEX idx_postback_unique ON postback_events(click_id, event, timestamp);

-- Facebook Campaigns
CREATE TABLE IF NOT EXISTS facebook_campaigns (
  id VARCHAR(255) PRIMARY KEY,
  campaign_id VARCHAR(255) UNIQUE NOT NULL,
  campaign_name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) DEFAULT 'facebook',
  status VARCHAR(50) DEFAULT 'ACTIVE',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  budget DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'BRL',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_facebook_campaigns_status ON facebook_campaigns(status);

-- Facebook Metrics
CREATE TABLE IF NOT EXISTS facebook_metrics (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(255) NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(10, 2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  ctr DECIMAL(5, 2) DEFAULT 0,
  cpc DECIMAL(10, 2) DEFAULT 0,
  roas DECIMAL(5, 2) DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX idx_facebook_metrics_campaign_id ON facebook_metrics(campaign_id);
CREATE INDEX idx_facebook_metrics_date ON facebook_metrics(date);

-- WhatsApp Messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id VARCHAR(255) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'QUEUED',
  user_id VARCHAR(255),
  template VARCHAR(100),
  instance VARCHAR(50) DEFAULT 'default',
  evolution_id VARCHAR(255),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_user_id ON whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_phone ON whatsapp_messages(phone);

-- ============================================
-- SETTINGS & CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO settings (key, value, description) VALUES
  ('postback.config', '{"enabled": true, "allowed_events": ["DEPOSIT", "REGISTRATION", "BET", "WITHDRAWAL"]}', 'Configuração do serviço de postback'),
  ('whatsapp.config', '{"enabled": true, "default_instance": "dashigaming", "bulk_delay": 1000}', 'Configuração do serviço WhatsApp'),
  ('recovery.config', '{"enabled": true, "check_interval_hours": 4, "max_reminders": 3}', 'Configuração de recuperação de leads'),
  ('igaming.config', '{"currency": "BRL", "timezone": "America/Sao_Paulo", "min_deposit": 20.00}', 'Configurações específicas iGaming')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_affiliates_updated_at BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_conversions_updated_at BEFORE UPDATE ON conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_commissions_updated_at BEFORE UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payouts_updated_at BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_facebook_campaigns_updated_at BEFORE UPDATE ON facebook_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
