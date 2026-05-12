import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get lead statistics
    const [
      totalLeads,
      newLeads,
      activeLeads,
      inactiveLeads,
      churnedLeads,
      leadsBySource,
      allLeads,
      recentEvents,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'NEW' } }),
      prisma.lead.count({ where: { status: 'ACTIVE' } }),
      prisma.lead.count({ where: { status: 'INACTIVE' } }),
      prisma.lead.count({ where: { status: 'CHURNED' } }),
      prisma.lead.groupBy({
        by: ['source'],
        _count: true,
        where: {
          source: { not: null },
        },
      }),
      prisma.lead.findMany({
        select: { tags: true },
      }),
      prisma.leadEvent.findMany({
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
      }),
    ]);

    // Calculate tag distribution
    const tagDistribution: Record<string, number> = {};
    allLeads.forEach((lead) => {
      const tags = lead.tags as string[] || [];
      tags.forEach((tag) => {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      });
    });

    // Calculate conversion rate
    const conversionRate =
      totalLeads > 0 ? (activeLeads / totalLeads) * 100 : 0;

    const stats = {
      totalLeads,
      newLeads,
      activeLeads,
      inactiveLeads,
      churnedLeads,
      conversionRate,
      leadsBySource: leadsBySource.map((item) => ({
        source: item.source,
        count: item._count,
      })),
      tagDistribution,
      recentEvents,
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
