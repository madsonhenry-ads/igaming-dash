// Tipos compartilhados entre os microsserviços

export interface PostbackEvent {
  clickId: string;
  event: 'deposit' | 'registration' | 'bet' | 'withdrawal';
  amount?: number;
  currency: string;
  timestamp: string;
  userId?: string;
  ip?: string;
}

export interface FacebookAdsMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
  date: string;
}

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'pending' | 'suspended';
  commissionRate: number;
  totalConversions: number;
  totalRevenue: number;
  totalPaid: number;
  balance: number;
}

export interface Conversion {
  id: string;
  clickId: string;
  affiliateId: string;
  event: PostbackEvent['event'];
  amount: number;
  currency: string;
  commission: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export interface WhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  userId?: string;
  template?: string;
  sentAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: 'facebook' | 'organic' | 'affiliate';
  clickId?: string;
  affiliateId?: string;
  status: 'registered' | 'deposit_pending' | 'active' | 'churned';
  firstDepositAt?: string;
  lastActivityAt?: string;
  totalDeposits: number;
  lifetimeValue: number;
  createdAt: string;
}

export type PostbackEventType = PostbackEvent['event'];
export type ConversionStatus = Conversion['status'];
export type LeadStatus = Lead['status'];
