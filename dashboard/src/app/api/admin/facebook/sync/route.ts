import { NextRequest, NextResponse } from 'next/server';
import { facebookService } from '@/lib/facebook';

// POST - Sync Facebook campaigns and metrics
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    // Basic auth check
    // Note: In production, verify the user has proper permissions
    const body = await request.json();

    const { adAccountId, startDate, endDate } = body;

    if (!adAccountId) {
      return NextResponse.json(
        { error: 'adAccountId is required' },
        { status: 400 }
      );
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    // Sync campaigns
    const syncedCampaigns = await facebookService.syncCampaigns(adAccountId);

    // Get campaigns to sync metrics for
    const { prisma } = await import('@/lib/prisma');
    const campaigns = await prisma.facebookCampaign.findMany({
      where: { status: 'ACTIVE' },
    });

    let syncedMetrics = 0;
    for (const campaign of campaigns) {
      const count = await facebookService.syncMetrics(campaign.campaignId, start, end);
      syncedMetrics += count;
    }

    return NextResponse.json({
      success: true,
      data: {
        syncedCampaigns,
        syncedMetrics,
      },
    });
  } catch (error) {
    console.error('Error syncing Facebook data:', error);
    return NextResponse.json(
      { error: 'Failed to sync Facebook data' },
      { status: 500 }
    );
  }
}
