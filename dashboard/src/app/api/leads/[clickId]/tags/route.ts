import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';

// PUT - Add or remove tags from lead
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clickId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id')!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { clickId } = await params;
    const body = await request.json();

    const { action, tag, reason } = body; // action: 'add' | 'remove'

    if (!action || !tag) {
      return NextResponse.json(
        { error: 'action and tag are required' },
        { status: 400 }
      );
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json(
        { error: 'action must be "add" or "remove"' },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findUnique({
      where: { clickId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const currentTags = (lead.tags as string[]) || [];
    let updatedTags: string[];

    if (action === 'add') {
      if (currentTags.includes(tag)) {
        return NextResponse.json(
          { error: 'Tag already exists on lead' },
          { status: 409 }
        );
      }
      updatedTags = [...currentTags, tag];
    } else {
      if (!currentTags.includes(tag)) {
        return NextResponse.json(
          { error: 'Tag not found on lead' },
          { status: 404 }
        );
      }
      updatedTags = currentTags.filter((t) => t !== tag);
    }

    // Update lead tags
    const updatedLead = await prisma.lead.update({
      where: { clickId },
      data: { tags: updatedTags },
    });

    // Create tag history entry
    await prisma.tagHistory.create({
      data: {
        leadId: lead.id,
        tag,
        added: action === 'add',
        reason: reason || `Tag ${action === 'add' ? 'added' : 'removed'} manually`,
      },
    });

    // Log audit
    await logAuditAction({
      actorId: userId,
      action: action === 'add' ? 'ADD_TAG' : 'REMOVE_TAG',
      objectType: 'LEAD',
      objectId: lead.id,
      payload: { clickId, tag, action },
    });

    return NextResponse.json({ success: true, data: updatedLead });
  } catch (error) {
    console.error('Error updating lead tags:', error);
    return NextResponse.json({ error: 'Failed to update lead tags' }, { status: 500 });
  }
}
