import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Set user as ADMIN
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const result = await prisma.user.update({
      where: { email },
      data: {
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User updated to ADMIN',
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
        status: result.status,
      },
    });
  } catch (error: any) {
    console.error('Error setting admin:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set admin' },
      { status: 500 }
    );
  }
}
