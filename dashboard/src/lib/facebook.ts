// Facebook Ads API integration service

export interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  daily_budget?: number;
  lifetime_budget?: number;
  start_time?: string;
  stop_time?: string;
}

export interface FacebookMetrics {
  date: Date;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue?: number;
  ctr: number;
  cpc: number;
  roas?: number;
}

class FacebookService {
  private appId: string;
  private appSecret: string;
  private accessToken: string;

  constructor() {
    this.appId = process.env.FACEBOOK_APP_ID || '';
    this.appSecret = process.env.FACEBOOK_APP_SECRET || '';
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN || '';
  }

  private async makeRequest(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Facebook access token is not configured');
    }

    const url = new URL(`https://graph.facebook.com/v19.0${endpoint}`);
    url.searchParams.append('access_token', this.accessToken);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  /**
   * Get all campaigns for the ad account
   */
  async getCampaigns(adAccountId: string): Promise<FacebookCampaign[]> {
    const data = await this.makeRequest(`/${adAccountId}/campaigns`, {
      fields: 'id,name,status,daily_budget,lifetime_budget,start_time,stop_time',
      limit: '100',
    });

    return data.data || [];
  }

  /**
   * Get campaign insights (metrics) for a date range
   */
  async getCampaignInsights(
    campaignId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FacebookMetrics[]> {
    const data = await this.makeRequest(`/${campaignId}/insights`, {
      fields: 'date,impressions,clicks,spend,conversions,ctr,cpc',
      time_range: JSON.stringify({
        since: startDate.toISOString().split('T')[0],
        until: endDate.toISOString().split('T')[0],
      }),
      level: 'campaign',
      time_increment: '1',
    });

    return (data.data || []).map((item: any) => ({
      date: new Date(item.date),
      impressions: parseInt(item.impressions) || 0,
      clicks: parseInt(item.clicks) || 0,
      spend: parseFloat(item.spend) || 0,
      conversions: parseInt(item.conversions) || 0,
      ctr: parseFloat(item.ctr) || 0,
      cpc: parseFloat(item.cpc) || 0,
    }));
  }

  /**
   * Create a new campaign
   */
  async createCampaign(
    adAccountId: string,
    params: {
      name: string;
      objective: string;
      status?: string;
      daily_budget?: number;
      lifetime_budget?: number;
    }
  ): Promise<FacebookCampaign> {
    const data = await this.makeRequest(`/${adAccountId}/campaigns`, {
      name: params.name,
      objective: params.objective,
      status: params.status || 'PAUSED',
      ...(params.daily_budget && { daily_budget: params.daily_budget }),
      ...(params.lifetime_budget && { lifetime_budget: params.lifetime_budget }),
    });

    return data;
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    campaignId: string,
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  ): Promise<void> {
    await this.makeRequest(`/${campaignId}`, { status });
  }

  /**
   * Sync campaign data to database
   */
  async syncCampaigns(adAccountId: string): Promise<number> {
    const { prisma } = await import('@/lib/prisma');

    const campaigns = await this.getCampaigns(adAccountId);

    let syncedCount = 0;

    for (const campaign of campaigns) {
      try {
        // Upsert campaign
        await prisma.facebookCampaign.upsert({
          where: { campaignId: campaign.id },
          create: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            status: campaign.status as any,
            budget: campaign.daily_budget || campaign.lifetime_budget || null,
          },
          update: {
            campaignName: campaign.name,
            status: campaign.status as any,
            budget: campaign.daily_budget || campaign.lifetime_budget || null,
          },
        });

        syncedCount++;
      } catch (error) {
        console.error(`Error syncing campaign ${campaign.id}:`, error);
      }
    }

    return syncedCount;
  }

  /**
   * Sync campaign metrics to database
   */
  async syncMetrics(
    campaignId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { prisma } = await import('@/lib/prisma');

    const metrics = await this.getCampaignInsights(campaignId, startDate, endDate);

    let syncedCount = 0;

    for (const metric of metrics) {
      try {
        await prisma.facebookMetrics.upsert({
          where: {
            campaignId_date: {
              campaignId,
              date: metric.date,
            },
          },
          create: {
            campaignId,
            date: metric.date,
            impressions: metric.impressions,
            clicks: metric.clicks,
            spend: metric.spend,
            conversions: metric.conversions,
            ctr: metric.ctr,
            cpc: metric.cpc,
          },
          update: {
            impressions: metric.impressions,
            clicks: metric.clicks,
            spend: metric.spend,
            conversions: metric.conversions,
            ctr: metric.ctr,
            cpc: metric.cpc,
          },
        });

        syncedCount++;
      } catch (error) {
        console.error(`Error syncing metric for ${campaignId} on ${metric.date}:`, error);
      }
    }

    return syncedCount;
  }
}

export const facebookService = new FacebookService();
