import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash, timingSafeEqual } from 'crypto';
import { logAuditAction } from '@/lib/audit';

// Event type to tag mapping
const EVENT_TAG_MAP: Record<string, string> = {
  registration: 'visitante',
  ftd: 'ftd',
  deposit: 'deposito',
  redeposit: 'redeposito',
  recovery: 'recuperacao',
  withdrawal: 'saque',
  bet: 'aposta',
};

// POST - Receive postback from iGaming platforms
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Security check - verify webhook secret if provided
    const webhookSecret = process.env.POSTBACK_WEBHOOK_SECRET;
    const clientSecret = request.headers.get('x-webhook-secret');

    if (webhookSecret && clientSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clickId, event, amount, currency, metadata, timestamp } = body;

    // Validate required fields
    if (!clickId || !event) {
      return NextResponse.json(
        { error: 'clickId and event are required' },
        { status: 400 }
      );
    }

    // Find lead by clickId
    let lead = await prisma.lead.findUnique({
      where: { clickId },
    });

    if (!lead) {
      // Create lead if not exists (optional - depends on your workflow)
      lead = await prisma.lead.create({
        data: {
          clickId,
          status: 'ACTIVE',
          tags: [],
          metadata: metadata || {},
        },
      });

      // Log this as system action
      await logAuditAction({
        actorId: 'system',
        action: 'AUTO_CREATE_LEAD',
        objectType: 'LEAD',
        objectId: lead.id,
        payload: { clickId, event, source: 'postback' },
      });

      // No need to update reference since we already reassigned lead
    }

    // Check for duplicate events (same event type in last minute)
    const recentEvent = await prisma.leadEvent.findFirst({
      where: {
        leadId: lead.id,
        event,
        createdAt: {
          gte: new Date(Date.now() - 60000), // 1 minute ago
        },
      },
    });

    if (recentEvent) {
      return NextResponse.json(
        { error: 'Duplicate event detected', status: 'duplicate' },
        { status: 409 }
      );
    }

    // Create lead event
    const leadEvent = await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        event,
        amount: amount ? parseFloat(amount.toString()) : null,
        currency: currency || 'BRL',
        metadata: metadata || {},
      },
    });

    // Update lead tags based on event
    const tagToAdd = EVENT_TAG_MAP[event];
    const currentTags = (lead.tags as string[]) || [];

    if (tagToAdd && !currentTags.includes(tagToAdd)) {
      const updatedTags = [...currentTags, tagToAdd];

      await prisma.lead.update({
        where: { id: lead.id },
        data: { tags: updatedTags },
      });

      // Create tag history
      await prisma.tagHistory.create({
        data: {
          leadId: lead.id,
          tag: tagToAdd,
          added: true,
          reason: `Auto-tagged from postback event: ${event}`,
        },
      });
    }

    // Update lead status based on events
    if (event === 'ftd' || event === 'deposit') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'ACTIVE' },
      });
    }

    // Also create/update PostbackEvent for tracking
    await prisma.postbackEvent.create({
      data: {
        clickId,
        event: event.toUpperCase() as any,
        amount: amount ? parseFloat(amount.toString()) : null,
        currency: currency || 'BRL',
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        metadata: metadata || {},
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        leadId: lead.id,
        eventId: leadEvent.id,
        tagAdded: tagToAdd,
      },
    });
  } catch (error) {
    console.error('Error processing postback:', error);
    return NextResponse.json({ error: 'Failed to process postback' }, { status: 500 });
  }
}
