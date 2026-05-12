import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';

// GET - List all leads
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const tag = searchParams.get('tag') || '';

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

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

// POST - Create new lead
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();

    const { clickId, email, phone, name, source, campaignId, tags, metadata } = body;

    // Validate required fields
    if (!clickId) {
      return NextResponse.json({ error: 'clickId is required' }, { status: 400 });
    }

    // Check if lead already exists
    const existingLead = await prisma.lead.findUnique({
      where: { clickId },
    });

    if (existingLead) {
      return NextResponse.json(
        { error: 'Lead with this clickId already exists' },
        { status: 409 }
      );
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        clickId,
        email: email || null,
        phone: phone || null,
        name: name || null,
        source: source || null,
        campaignId: campaignId || null,
        tags: tags || [],
        metadata: metadata || {},
      },
    });

    // Create initial click event
    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        event: 'click',
        metadata: { source, campaignId },
      },
    });

    // Log audit
    await logAuditAction({
      actorId: userId,
      action: 'CREATE_LEAD',
      objectType: 'LEAD',
      objectId: lead.id,
      payload: { clickId, email, source },
    });

    return NextResponse.json({ success: true, data: lead }, { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
