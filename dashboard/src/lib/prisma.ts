import { PrismaClient } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import * as bcrypt from 'bcryptjs';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization — avoids crashing at import time when DATABASE_URL
// is unavailable (e.g. during Docker build prerendering)
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getPrismaClient(), prop);
  },
});

// Database service class with Prisma methods
export class DatabaseService {
  // User operations
  async createUser(userData: {
    email: string;
    password: string; // Already hashed by the caller/AuthService
    name: string;
    role: 'ADMIN';
  }) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role,
        status: 'ACTIVE',
      },
    });

    return user;
  }

  async getUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  async getUserById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  async updateUser(id: string, updates: Parameters<typeof prisma.user.update>[0]['data']) {
    return await prisma.user.update({
      where: { id },
      data: updates,
    });
  }

  async verifyPassword(password: string, hashedPassword: string) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Lead operations
  async createLead(leadData: {
    clickId: string;
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    source?: string | null;
    campaignId?: string | null;
    tags?: string[];
    metadata?: any;
  }) {
    return await prisma.lead.create({
      data: {
        clickId: leadData.clickId,
        email: leadData.email || null,
        phone: leadData.phone || null,
        name: leadData.name || null,
        source: leadData.source || null,
        campaignId: leadData.campaignId || null,
        tags: leadData.tags || [],
        metadata: leadData.metadata || {},
      },
    });
  }

  async getLeadByClickId(clickId: string) {
    return await prisma.lead.findUnique({
      where: { clickId },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
        },
        tagsHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getLeads(filters?: {
    search?: string;
    status?: string;
    source?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, source, tag, page = 1, limit = 50 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { name: { contains: search, mode: 'insensitive' } },
        { clickId: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    if (tag) {
      where.tags = {
        array_contains: tag,
      };
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          events: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              events: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateLead(clickId: string, updates: Parameters<typeof prisma.lead.update>[0]['data']) {
    return await prisma.lead.update({
      where: { clickId },
      data: updates,
    });
  }

  async deleteLead(clickId: string) {
    return await prisma.lead.delete({
      where: { clickId },
    });
  }

  async addTagToLead(leadId: string, tag: string, reason?: string) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const currentTags = (lead.tags as string[]) || [];

    if (currentTags.includes(tag)) {
      throw new Error('Tag already exists on lead');
    }

    const updatedTags = [...currentTags, tag];

    await prisma.lead.update({
      where: { id: leadId },
      data: { tags: updatedTags },
    });

    await prisma.tagHistory.create({
      data: {
        leadId,
        tag,
        added: true,
        reason: reason || `Tag added manually`,
      },
    });

    return updatedTags;
  }

  async removeTagFromLead(leadId: string, tag: string, reason?: string) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const currentTags = (lead.tags as string[]) || [];

    if (!currentTags.includes(tag)) {
      throw new Error('Tag not found on lead');
    }

    const updatedTags = currentTags.filter((t) => t !== tag);

    await prisma.lead.update({
      where: { id: leadId },
      data: { tags: updatedTags },
    });

    await prisma.tagHistory.create({
      data: {
        leadId,
        tag,
        added: false,
        reason: reason || `Tag removed manually`,
      },
    });

    return updatedTags;
  }

  // Lead Event operations
  async createLeadEvent(eventData: {
    leadId: string;
    event: string;
    amount?: number | null;
    currency?: string;
    metadata?: any;
  }) {
    return await prisma.leadEvent.create({
      data: {
        leadId: eventData.leadId,
        event: eventData.event,
        amount: eventData.amount || null,
        currency: eventData.currency || 'BRL',
        metadata: eventData.metadata || {},
      },
    });
  }

  async getLeadEvents(leadId: string) {
    return await prisma.leadEvent.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Postback Event operations
  async createPostbackEvent(eventData: {
    clickId: string;
    event: string;
    amount?: number | null;
    currency?: string;
    timestamp?: Date;
    userId?: string | null;
    ip?: string | null;
    affiliateId?: string | null;
    metadata?: any;
  }) {
    return await prisma.postbackEvent.create({
      data: {
        clickId: eventData.clickId,
        event: eventData.event as any,
        amount: eventData.amount || null,
        currency: eventData.currency || 'BRL',
        timestamp: eventData.timestamp || new Date(),
        userId: eventData.userId || null,
        ip: eventData.ip || null,
        affiliateId: eventData.affiliateId || null,
        metadata: eventData.metadata || {},
        status: 'PENDING',
      },
    });
  }

  async getPostbackEvents(clickId?: string) {
    const where = clickId ? { clickId } : {};

    return await prisma.postbackEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  // Audit log operations
  async createAuditLog(logData: {
    actorId: string;
    action: string;
    objectType: string;
    objectId: string;
    payload?: any;
  }) {
    return await prisma.auditLog.create({
      data: {
        actorId: logData.actorId,
        action: logData.action,
        objectType: logData.objectType,
        objectId: logData.objectId,
        payload: logData.payload || {},
      },
    });
  }

  // Settings operations
  getPlatformSettings = unstable_cache(
    async () => {
      // Return the first program's settings as default
      return await prisma.programSettings.findFirst();
    },
    ['platform-settings'],
    { tags: ['platform-settings'], revalidate: 3600 }
  );

  getProgramSettings = unstable_cache(
    async (programId: string) => {
      return await prisma.programSettings.findUnique({
        where: { programId },
      });
    },
    ['program-settings'],
    { tags: ['program-settings'], revalidate: 3600 }
  );

  // Analytics and statistics
  async getLeadStats() {
    const [
      totalLeads,
      newLeads,
      activeLeads,
      inactiveLeads,
      churnedLeads,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'NEW' } }),
      prisma.lead.count({ where: { status: 'ACTIVE' } }),
      prisma.lead.count({ where: { status: 'INACTIVE' } }),
      prisma.lead.count({ where: { status: 'CHURNED' } }),
    ]);

    // Get leads by source
    const leadsBySource = await prisma.lead.groupBy({
      by: ['source'],
      _count: true,
      where: {
        source: { not: null },
      },
    });

    // Get tags distribution
    const allLeads = await prisma.lead.findMany({
      select: { tags: true },
    });

    const tagDistribution: Record<string, number> = {};
    allLeads.forEach((lead) => {
      const tags = lead.tags as string[] || [];
      tags.forEach((tag) => {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      });
    });

    // Get recent events
    const recentEvents = await prisma.leadEvent.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        lead: {
          select: {
            clickId: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return {
      totalLeads,
      newLeads,
      activeLeads,
      inactiveLeads,
      churnedLeads,
      leadsBySource: leadsBySource.map((item) => ({
        source: item.source,
        count: item._count,
      })),
      tagDistribution,
      recentEvents,
    };
  }

  async getPlatformStats() {
    const stats = await this.getLeadStats();

    return {
      ...stats,
      conversionRate: stats.totalLeads > 0
        ? (stats.activeLeads / stats.totalLeads) * 100
        : 0,
    };
  }

  // Facebook Campaign operations
  async createFacebookCampaign(campaignData: {
    campaignId: string;
    campaignName: string;
    status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';
    startDate?: Date | null;
    endDate?: Date | null;
    budget?: number | null;
    currency?: string;
  }) {
    return await prisma.facebookCampaign.create({
      data: {
        campaignId: campaignData.campaignId,
        campaignName: campaignData.campaignName,
        status: (campaignData.status || 'ACTIVE') as any,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        budget: campaignData.budget ? parseFloat(campaignData.budget.toString()) : undefined,
        currency: campaignData.currency,
      },
    });
  }

  async getFacebookCampaigns() {
    return await prisma.facebookCampaign.findMany({
      include: {
        metrics: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async syncFacebookMetrics(campaignId: string, metrics: {
    date: Date;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    roas: number;
  }) {
    return await prisma.facebookMetrics.upsert({
      where: {
        campaignId_date: {
          campaignId,
          date: metrics.date,
        },
      },
      create: {
        campaignId,
        ...metrics,
      },
      update: metrics,
    });
  }

  // Seed data for development
  async seedDatabase() {
    try {
      // Check if data already exists
      const existingUsers = await prisma.user.count();
      if (existingUsers > 0) {
        console.log('Database already seeded');
        return;
      }

      // Create admin user
      const adminUser = await this.createUser({
        email: 'admin@example.com',
        password: 'password',
        name: 'Admin User',
        role: 'ADMIN',
      });

      // Create program settings
      await prisma.programSettings.create({
        data: {
          programId: 'default',
          productName: 'iGaming Platform',
          programName: 'Default Program',
          websiteUrl: 'https://example.com',
          currency: 'BRL',
          companyName: 'My Gaming Company',
        },
      });

      // Create sample leads
      await this.createLead({
        clickId: 'fb-click-123',
        email: 'john@example.com',
        name: 'John Doe',
        source: 'facebook',
        campaignId: 'fb-camp-1',
        tags: ['visitante'],
        metadata: {
          fbc: 'fb.1.1234567890.123456789',
          device: 'mobile',
        },
      });

      await this.createLead({
        clickId: 'gg-click-456',
        email: 'jane@example.com',
        name: 'Jane Smith',
        source: 'google',
        campaignId: 'gg-camp-1',
        tags: ['ftd', 'deposito'],
        metadata: {
          device: 'desktop',
        },
      });

      await this.createLead({
        clickId: 'inst-click-789',
        email: 'mike@example.com',
        name: 'Mike Johnson',
        source: 'instagram',
        campaignId: 'inst-camp-1',
        tags: ['visitante', 'ftd', 'deposito', 'redeposito'],
        metadata: {
          device: 'mobile',
        },
      });

      console.log('Database seeded successfully with sample data');
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }
  }
}

export const db = new DatabaseService();
