import { NextRequest, NextResponse } from 'next/server';
import { db, prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import crypto from 'crypto';

// ─── Webhook Signature Verification ────────────────────────────
function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch (_e) {
    return false;
  }
}

async function verifyApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) return false;

  // Hash the incoming key and look up by keyHash for secure comparison
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const key = await prisma.apiKey.findFirst({
    where: { keyHash, isActive: true }
  }).catch(() => null);

  return !!key;
}

export async function POST(request: NextRequest) {
  try {
    // ─── Authentication: Require API key OR webhook signature ───
    const rawBody = await request.text();
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const signature = request.headers.get('x-webhook-signature') || request.headers.get('x-refferq-signature');

    let authenticated = false;

    // Method 1: API key authentication
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      authenticated = await verifyApiKey(request);
    }

    // Method 2: Webhook signature verification
    if (!authenticated && webhookSecret && signature) {
      authenticated = verifyWebhookSignature(rawBody, signature, webhookSecret);
    }

    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Valid API key or webhook signature required' },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);
    const {
      event_type,
      amount_cents,
      currency = 'USD',
      customer_email,
      attribution_key,
      referral_code,
      event_metadata = {},
    } = body;

    // Validate required fields
    if (!event_type || !customer_email) {
      return NextResponse.json(
        { success: false, message: 'Event type and customer email are required' },
        { status: 400 }
      );
    }

    let affiliate = null;
    let attributionMethod = 'none';

    // Try to find affiliate through attribution key first
    if (attribution_key) {
      // In a real implementation, this would be stored in Redis
      // For this simulation, we'll comment out the problematic call
      // const recentClicks = await db.getClicksByReferralId('some-referral-id');
      // For demo purposes, we'll use referral_code method
      attributionMethod = 'attribution_key';
    }

    // Fallback to referral code
    if (!affiliate && referral_code) {
      const affiliateData = await prisma.affiliate.findUnique({
        where: { code: referral_code },
        include: { user: true }
      });
      if (affiliateData) {
        affiliate = affiliateData;
      }
      attributionMethod = 'referral_code';
    }

    // If no affiliate found, log the conversion but don't create commission
    if (!affiliate) {
      console.log('Conversion received but no affiliate attribution found:', {
        event_type,
        customer_email,
        attribution_key,
        referral_code,
      });

      return NextResponse.json({
        success: true,
        message: 'Conversion logged (no attribution)',
        attributed: false,
      });
    }

    // Create conversion record
    // First create/find referral if needed
    let referral = await prisma.referral.findFirst({
      where: {
        affiliateId: affiliate.id,
        leadEmail: customer_email
      }
    });

    if (!referral && customer_email) {
      referral = await prisma.referral.create({
        data: {
          affiliateId: affiliate.id,
          leadEmail: customer_email,
          status: 'APPROVED'
        }
      });
    }

    if (!referral) {
      return NextResponse.json({
        success: true,
        message: 'Conversion logged (no referral found)',
        attributed: false,
      });
    }

    const conversion = await prisma.conversion.create({
      data: {
        referralId: referral.id,
        amountCents: amount_cents || 0,
        status: 'PENDING',
        metadata: {
          ...event_metadata,
          customerEmail: customer_email,
          attributionMethod,
          attributionKey: attribution_key,
          referralCode: referral_code,
          eventType: event_type,
          currency
        },
      },
    });

    // Calculate commission
    const commissionRules = await prisma.commissionRule.findMany({
      where: { isActive: true }
    });
    let applicableRule = commissionRules.find((rule: any) => rule.isDefault);

    const commissionRate = applicableRule?.value || 15;
    let commissionAmount = 0;

    if (applicableRule?.type === 'percentage' && amount_cents) {
      commissionAmount = Math.floor((amount_cents * commissionRate) / 100);
    } else if (applicableRule?.type === 'fixed') {
      commissionAmount = commissionRate;
    }

    // ─── Commission Hold Period ─────────────────────────────────
    // Fetch hold days from ProgramSettings (default 30)
    const settings = await prisma.programSettings.findFirst();
    const holdDays = (settings as any)?.commissionHoldDays ?? 30;
    const maturesAt = new Date();
    maturesAt.setDate(maturesAt.getDate() + holdDays);

    // Create commission record with maturesAt (status stays PENDING until maturation)
    const commission = await prisma.commission.create({
      data: {
        conversionId: conversion.id,
        affiliateId: affiliate.id,
        referralId: referral.id,
        amountCents: commissionAmount,
        rate: commissionRate,
        status: 'PENDING',
        maturesAt,
      },
    });

    // NOTE: We do NOT update balanceCents here anymore.
    // Balance is only updated when the commission matures (PENDING → APPROVED).
    // This protects against refunds during the hold period.

    // Log audit event
    await logAuditAction({
      actorId: 'system',
      action: 'conversion_tracked',
      objectType: 'conversion',
      objectId: conversion.id,
      payload: {
        event_type,
        amount_cents,
        commission_amount: commissionAmount,
        affiliate_id: affiliate.id,
        attributionMethod,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Conversion tracked successfully',
      attributed: true,
      conversion,
      commission,
      attributionMethod,
    });
  } catch (error) {
    console.error('Conversion webhook error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process conversion' },
      { status: 500 }
    );
  }
}