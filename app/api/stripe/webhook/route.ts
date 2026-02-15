import { NextRequest, NextResponse } from 'next/server';
import { getStripe, createSubscriptionEnrollments, handleSubscriptionCanceled, type PlanType } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';

export const runtime = 'nodejs';

// Desabilitar body parsing — Stripe precisa do raw body
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    apiLogger.error('STRIPE_WEBHOOK_SECRET não configurado');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    apiLogger.error({ err }, 'Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, plan, courseId } = session.metadata || {};

        if (!userId || !plan) {
          apiLogger.error({ metadata: session.metadata }, 'Missing metadata in checkout session');
          break;
        }

        // Buscar a subscription do Stripe
        const stripeSubscription = await getStripe().subscriptions.retrieve(
          session.subscription as string
        );

        // Criar Subscription no banco
        await prisma.subscription.create({
          data: {
            userId,
            stripeSubscriptionId: stripeSubscription.id,
            stripePriceId: stripeSubscription.items.data[0].price.id,
            plan,
            courseId: courseId || null,
            status: stripeSubscription.status,
            currentPeriodStart: new Date(stripeSubscription.items.data[0].current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.items.data[0].current_period_end * 1000),
          },
        });

        // Criar enrollments
        await createSubscriptionEnrollments(userId, plan as PlanType, courseId || undefined);

        apiLogger.info({ userId, plan, subscriptionId: stripeSubscription.id }, 'Subscription created via checkout');
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const subscriptionId = invoice.parent?.subscription_details?.subscription as string;

        if (!subscriptionId) break;

        const stripeSubscription = await getStripe().subscriptions.retrieve(subscriptionId);

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            status: 'active',
            currentPeriodStart: new Date(stripeSubscription.items.data[0].current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.items.data[0].current_period_end * 1000),
          },
        });

        apiLogger.info({ subscriptionId }, 'Subscription renewed via invoice.paid');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.parent?.subscription_details?.subscription as string;

        if (!subscriptionId) break;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'past_due' },
        });

        apiLogger.warn({ subscriptionId }, 'Payment failed — status set to past_due');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodStart: new Date(subscription.items.data[0].current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
          },
        });

        apiLogger.info(
          { subscriptionId: subscription.id, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end },
          'Subscription updated'
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        const dbSubscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (dbSubscription) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: { status: 'canceled' },
          });

          // Remover enrollments da subscription
          await handleSubscriptionCanceled(
            dbSubscription.userId,
            dbSubscription.plan as PlanType,
            dbSubscription.courseId || undefined
          );

          apiLogger.info({ subscriptionId: subscription.id, userId: dbSubscription.userId }, 'Subscription canceled and enrollments removed');
        }
        break;
      }

      default:
        apiLogger.info({ type: event.type }, 'Unhandled webhook event');
    }
  } catch (error) {
    apiLogger.error({ err: error, eventType: event.type }, 'Webhook handler error');
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
