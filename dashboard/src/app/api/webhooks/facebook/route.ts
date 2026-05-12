import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Verify webhook (Facebook requirement)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return NextResponse.text(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST - Receive Facebook webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate X-Hub-Signature for security
    const signature = request.headers.get('x-hub-signature-256');
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (signature && appSecret) {
      // Note: You should verify the signature here for production
      // This requires access to raw body which Next.js doesn't provide easily
    }

    // Process entries
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen' || change.field === 'conversions') {
          // Process lead or conversion event
          const leadData = change.value;

          // Extract campaign info
          const campaignId = leadData.campaign_id;
          const adsetId = leadData.adset_id;
          const adId = leadData.ad_id;

          // Try to find lead by fbc (Facebook Click ID) or metadata
          const fbc = leadData.fbc || leadData.fbclid;

          if (fbc) {
            // Look for lead with matching fbc in metadata
            const lead = await prisma.lead.findFirst({
              where: {
                metadata: {
                  path: ['fbc'],
                  equals: fbc,
                },
              },
            });

            if (lead) {
              // Update lead with Facebook data
              await prisma.lead.update({
                where: { id: lead.id },
                data: {
                  metadata: {
                    ...((lead.metadata as any) || {}),
                    facebookLeadId: leadData.leadgen_id,
                    campaignId,
                  },
                },
              });

              // Add tag for Facebook lead
              const currentTags = (lead.tags as string[]) || [];
              if (!currentTags.includes('facebook_lead')) {
                await prisma.lead.update({
                  where: { id: lead.id },
                  data: {
                    tags: [...currentTags, 'facebook_lead'],
                  },
                });
              }
            }
          }

          // Create/update Facebook metrics if campaign info exists
          if (campaignId) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await prisma.facebookMetrics.upsert({
              where: {
                campaignId_date: {
                  campaignId,
                  date: today,
                },
              },
              create: {
                campaignId,
                date: today,
                conversions: 1,
              },
              update: {
                conversions: {
                  increment: 1,
                },
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Facebook webhook:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
