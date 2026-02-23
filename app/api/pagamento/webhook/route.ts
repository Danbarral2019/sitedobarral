import { NextRequest, NextResponse } from 'next/server';
import { Payment } from 'mercadopago';
import { getMPClient, createSubscriptionEnrollments, handleSubscriptionCanceled, type PlanType } from '@/lib/mercadopago';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Mercado Pago envia notificações IPN com tipo e data.id
    const { type, data } = body;

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
      // Verificar se ja existe subscription ativa para este usuario/plano
      const existing = await prisma.subscription.findFirst({
        where: { userId, plan, status: 'active' },
      });

      if (!existing) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await prisma.subscription.create({
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

        // Criar enrollments
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
