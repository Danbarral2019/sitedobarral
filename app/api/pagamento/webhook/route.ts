import { NextRequest, NextResponse } from 'next/server';
import { Payment } from 'mercadopago';
import { getMPClient, createSubscriptionEnrollments, handleSubscriptionCanceled, type PlanType } from '@/lib/mercadopago';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';
import { createHmac } from 'crypto';

export const runtime = 'nodejs';

/**
 * Verifica a assinatura HMAC do webhook do Mercado Pago.
 * Header x-signature: ts=<timestamp>,v1=<hmac>
 * Manifest: id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;
 */
function verifyWebhookSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    apiLogger.warn('MERCADOPAGO_WEBHOOK_SECRET not configured — skipping HMAC verification');
    return true; // Fail open when secret not configured
  }

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  if (!xSignature || !xRequestId) {
    apiLogger.warn('MP webhook: missing x-signature or x-request-id headers');
    return false;
  }

  // Parse x-signature: ts=<timestamp>,v1=<hmac>
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(',')) {
    const [key, ...valueParts] = part.split('=');
    parts[key.trim()] = valueParts.join('=').trim();
  }

  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) {
    apiLogger.warn({ xSignature }, 'MP webhook: malformed x-signature header');
    return false;
  }

  // Build manifest and compute HMAC
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = createHmac('sha256', secret).update(manifest).digest('hex');

  return hmac === v1;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Mercado Pago envia notificações IPN com tipo e data.id
    const { type, data } = body;

    // Verificar assinatura HMAC do Mercado Pago
    if (data?.id && !verifyWebhookSignature(request, String(data.id))) {
      apiLogger.warn({ dataId: data.id }, 'MP webhook: HMAC signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    if (type !== 'payment' || !data?.id) {
      apiLogger.info({ type }, 'MP webhook: tipo ignorado');
      return NextResponse.json({ received: true });
    }

    // Buscar detalhes do pagamento na API do MP
    const client = getMPClient();
    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: data.id });

    if (!payment.external_reference) {
      apiLogger.warn({ paymentId: data.id }, 'MP webhook: sem external_reference');
      return NextResponse.json({ received: true });
    }

    let refData: { userId: string; plan: string; courseId: string };
    try {
      refData = JSON.parse(payment.external_reference);
    } catch {
      apiLogger.error({ paymentId: data.id, ref: payment.external_reference }, 'MP webhook: external_reference invalido');
      return NextResponse.json({ received: true });
    }

    const { userId, plan, courseId } = refData;

    if (!userId || !plan) {
      apiLogger.error({ refData }, 'MP webhook: dados incompletos no external_reference');
      return NextResponse.json({ received: true });
    }

    const paymentStatus = payment.status; // approved, pending, rejected, refunded, cancelled, in_process

    if (paymentStatus === 'approved') {
      // Usar transaction para evitar race condition (webhooks concorrentes)
      const created = await prisma.$transaction(async (tx) => {
        // Verificar se ja existe subscription ativa (dentro da transaction)
        const existing = await tx.subscription.findFirst({
          where: { userId, plan, status: 'active' },
        });

        if (existing) return false;

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await tx.subscription.create({
          data: {
            userId,
            plan,
            courseId: courseId || null,
            status: 'active',
            paymentMethod: payment.payment_method_id || 'pix',
            mercadopagoPreapprovalId: String(payment.id),
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });

        return true;
      });

      if (created) {
        // Criar enrollments (fora da transaction — idempotente)
        await createSubscriptionEnrollments(userId, plan as PlanType, courseId || undefined);

        apiLogger.info({ userId, plan, paymentId: payment.id }, 'Subscription created via MP webhook');
        trackServerEvent('payment_approved', { paymentId: String(payment.id) });
        trackServerEvent('subscription_created', { plan });
      } else {
        apiLogger.info({ userId, plan }, 'Subscription already active, skipping');
      }
    } else if (paymentStatus === 'refunded' || paymentStatus === 'cancelled') {
      const dbSubscription = await prisma.subscription.findFirst({
        where: { userId, plan, status: 'active' },
      });

      if (dbSubscription) {
        await prisma.subscription.update({
          where: { id: dbSubscription.id },
          data: { status: 'canceled' },
        });

        await handleSubscriptionCanceled(userId, plan as PlanType, courseId || undefined);

        apiLogger.info({ userId, plan, paymentId: payment.id }, 'Subscription canceled via MP webhook');
        trackServerEvent('payment_failed', { paymentId: String(payment.id), status: paymentStatus });
      }
    } else {
      apiLogger.info({ userId, plan, status: paymentStatus, paymentId: payment.id }, 'MP webhook: status pendente/outro');
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    apiLogger.error({ err: error }, 'MP webhook handler error');
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
