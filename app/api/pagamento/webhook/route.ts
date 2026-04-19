import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe, createEnrollmentsForSubscription, removeEnrollmentsForSubscription, calculatePeriodEnd, createBillingPortalSession } from '@/lib/stripe';
import type { PlanType, BillingCycle } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';
import { sendEmail } from '@/lib/email';
import {
  renderWelcomeEmail,
  renderReceiptEmail,
  renderCardFailedEmail,
  renderPixMandateFailedEmail,
  renderCanceledEmail,
} from '@/lib/email-templates/subscription';

export const runtime = 'nodejs';

// ── Ignored event types (return 200 silently) ─────────────────────────────

const IGNORED_EVENTS = new Set([
  'payment_intent.created',
  'payment_intent.succeeded',
  'payment_intent.processing',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'payment_method.attached',
  'payment_method.detached',
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'customer.subscription.created',
  'customer.subscription.trial_will_end',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
  'invoice.created',
  'invoice.finalized',
  'invoice.updated',
  'invoice.voided',
  'invoice.payment_action_required',
  'charge.succeeded',
  'charge.failed',
  'charge.updated',
  'checkout.session.expired',
  'setup_intent.created',
  'setup_intent.succeeded',
]);

// ── Email helper (no-op safe) ─────────────────────────────────────────────

async function trySendSubscriptionEmail<T>(
  renderFn: (data: T) => { subject: string; html: string; text?: string },
  to: string,
  data: T,
): Promise<void> {
  try {
    const { subject, html, text } = renderFn(data);
    if (!subject && !html) return; // stub template — skip
    await sendEmail({ to, subject, html, text });
  } catch (err) {
    apiLogger.warn({ err, to }, 'Failed to send subscription email (non-fatal)');
  }
}

/**
 * Best-effort billing portal URL. Failing to create a session shouldn't block
 * the email — fall back to the account page so the user still has somewhere to go.
 */
async function resolveBillingPortalUrl(userId: string): Promise<string> {
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';
  const accountUrl = `${siteUrl}/area-restrita`;
  try {
    const { url } = await createBillingPortalSession(userId, accountUrl);
    return url;
  } catch (err) {
    apiLogger.warn({ err, userId }, 'Failed to create billing portal session — using fallback URL');
    return accountUrl;
  }
}

// ── Metadata extraction helper ────────────────────────────────────────────

interface SubscriptionMeta {
  userId: string;
  plan: PlanType;
  billingCycle: BillingCycle;
  courseId?: string;
}

/**
 * In Stripe SDK v22+, `invoice.subscription` was removed in favor of
 * `invoice.parent.subscription_details.subscription`. This helper isolates
 * the traversal so all handlers share the same logic.
 */
function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === 'string' ? sub : sub.id;
}

/**
 * In Stripe SDK v22+, `subscription.current_period_end` was moved to the
 * subscription item level (`subscription.items.data[0].current_period_end`).
 * This helper centralizes the lookup and returns seconds since epoch, or
 * `null` when no items are present (should not happen in practice).
 */
function extractCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const first = subscription.items?.data?.[0];
  return first?.current_period_end ?? null;
}

/**
 * The Stripe SDK v22 dropped `Charge.invoice` from its type, but the API still
 * returns the field on charges that belong to an invoice. We restore the shape
 * locally so we don't have to run an extra `charges.retrieve` just to pull it.
 */
type ChargeWithInvoice = Stripe.Charge & { invoice?: string | Stripe.Invoice | null };

function extractChargeInvoiceId(charge: Stripe.Charge): string | null {
  const withInvoice = charge as ChargeWithInvoice;
  const inv = withInvoice.invoice;
  if (!inv) return null;
  return typeof inv === 'string' ? inv : inv.id ?? null;
}

function extractMeta(metadata: Record<string, string> | undefined | null): SubscriptionMeta | null {
  if (!metadata?.userId || !metadata?.plan) return null;
  return {
    userId: metadata.userId,
    plan: metadata.plan as PlanType,
    billingCycle: (metadata.billingCycle || 'monthly') as BillingCycle,
    courseId: metadata.courseId || undefined,
  };
}

// ── Handler: checkout.session.completed ───────────────────────────────────

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const meta = extractMeta(session.metadata as Record<string, string>);
  if (!meta) {
    apiLogger.warn({ sessionId: session.id }, 'Checkout session missing metadata');
    return;
  }

  const stripeSubscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : (session.subscription as Stripe.Subscription)?.id;

  if (!stripeSubscriptionId) {
    apiLogger.warn({ sessionId: session.id }, 'Checkout session has no subscription');
    return;
  }

  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, meta.billingCycle);

  await prisma.subscription.create({
    data: {
      userId: meta.userId,
      plan: meta.plan,
      billingCycle: meta.billingCycle,
      courseId: meta.courseId || null,
      status: 'active',
      paymentMethod: session.payment_method_types?.[0] || 'card',
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      stripeSubscriptionId,
      stripeCheckoutSessionId: session.id,
      stripePriceId: null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  await createEnrollmentsForSubscription({
    userId: meta.userId,
    plan: meta.plan,
    courseId: meta.courseId,
  });

  // Welcome email
  const user = await prisma.user.findUnique({ where: { id: meta.userId } });
  if (user?.email) {
    await trySendSubscriptionEmail(renderWelcomeEmail, user.email, {
      name: user.name || '',
      plan: meta.plan,
      billingCycle: meta.billingCycle,
    });
  }

  apiLogger.info({ userId: meta.userId, plan: meta.plan, stripeSubscriptionId }, 'Subscription created via checkout');
  trackServerEvent('subscription_created', { plan: meta.plan });
}

// ── Handler: invoice.paid ─────────────────────────────────────────────────

async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeSubscriptionId = extractInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) return;

  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!sub) {
    apiLogger.warn({ stripeSubscriptionId }, 'invoice.paid: subscription not found');
    return;
  }

  const billingCycle = (sub.billingCycle || 'monthly') as BillingCycle;
  const newPeriodEnd = calculatePeriodEnd(new Date(), billingCycle);

  await prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: { currentPeriodEnd: newPeriodEnd, status: 'active' },
  });

  if (sub.user?.email) {
    await trySendSubscriptionEmail(renderReceiptEmail, sub.user.email, {
      name: sub.user.name || '',
      plan: sub.plan,
      billingCycle,
      nextBillingDate: newPeriodEnd,
      amountPaidCents: invoice.amount_paid ?? 0,
      currency: invoice.currency || 'brl',
      invoiceUrl: invoice.hosted_invoice_url,
    });
  }

  apiLogger.info({ stripeSubscriptionId }, 'Subscription period renewed via invoice.paid');
}

// ── Handler: invoice.payment_failed ───────────────────────────────────────

async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeSubscriptionId = extractInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) return;

  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!sub) return;

  await prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: { status: 'past_due' },
  });

  if (sub.user?.email) {
    const renderFn = sub.paymentMethod === 'pix' ? renderPixMandateFailedEmail : renderCardFailedEmail;
    const billingPortalUrl = await resolveBillingPortalUrl(sub.userId);
    await trySendSubscriptionEmail(renderFn, sub.user.email, {
      name: sub.user.name || '',
      billingPortalUrl,
    });
  }

  apiLogger.warn({ stripeSubscriptionId }, 'Invoice payment failed — subscription past_due');
}

// ── Handler: customer.subscription.updated ────────────────────────────────

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const stripeSub = event.data.object as Stripe.Subscription;
  const stripeSubscriptionId = stripeSub.id;

  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (!sub) {
    apiLogger.warn({ stripeSubscriptionId }, 'subscription.updated: not found in DB');
    return;
  }

  const periodEndSeconds = extractCurrentPeriodEnd(stripeSub);

  await prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: {
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      status: stripeSub.status === 'active' ? 'active'
        : stripeSub.status === 'past_due' ? 'past_due'
        : stripeSub.status === 'canceled' ? 'canceled'
        : sub.status,
      ...(periodEndSeconds !== null && {
        currentPeriodEnd: new Date(periodEndSeconds * 1000),
      }),
    },
  });

  apiLogger.info({ stripeSubscriptionId, status: stripeSub.status }, 'Subscription updated');
}

// ── Handler: customer.subscription.deleted ────────────────────────────────

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const stripeSub = event.data.object as Stripe.Subscription;
  const stripeSubscriptionId = stripeSub.id;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: { status: 'canceled' },
  });

  await removeEnrollmentsForSubscription(stripeSubscriptionId);

  // Canceled email
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (sub?.user?.email) {
    await trySendSubscriptionEmail(renderCanceledEmail, sub.user.email, {
      name: sub.user.name || '',
      accessEndsAt: sub.currentPeriodEnd,
    });
  }

  apiLogger.info({ stripeSubscriptionId }, 'Subscription canceled');
  trackServerEvent('subscription_canceled', { stripeSubscriptionId });
}

// ── Handler: charge.refunded ──────────────────────────────────────────────

async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  const invoiceId = extractChargeInvoiceId(charge);
  if (!invoiceId) return;

  // Look up the subscription via the invoice
  const stripe = getStripe();
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const stripeSubscriptionId = extractInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) return;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: { status: 'canceled' },
  });

  await removeEnrollmentsForSubscription(stripeSubscriptionId);

  apiLogger.info({ stripeSubscriptionId }, 'Subscription canceled due to refund');
  trackServerEvent('charge_refunded', { stripeSubscriptionId });
}

// ── Handler: charge.dispute.created ───────────────────────────────────────

async function handleDisputeCreated(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;
  const charge = typeof dispute.charge === 'string' ? dispute.charge : (dispute.charge as Stripe.Charge)?.id;

  if (!charge) return;

  const stripe = getStripe();
  const chargeObj = typeof dispute.charge === 'string'
    ? await stripe.charges.retrieve(dispute.charge)
    : dispute.charge as Stripe.Charge;

  const invoiceId = extractChargeInvoiceId(chargeObj);
  if (!invoiceId) return;

  const invoice = await stripe.invoices.retrieve(invoiceId);
  const stripeSubscriptionId = extractInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) return;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: { status: 'canceled' },
  });

  await removeEnrollmentsForSubscription(stripeSubscriptionId);

  // Sentry alert for disputes
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureMessage(`Stripe dispute created for subscription ${stripeSubscriptionId}`, 'error');
  } catch {
    // Sentry not available
  }

  apiLogger.error({ stripeSubscriptionId, disputeId: dispute.id }, 'Dispute created — subscription canceled');
  trackServerEvent('charge_disputed', { stripeSubscriptionId });
}

// ── Event dispatcher ──────────────────────────────────────────────────────

const HANDLERS: Record<string, (event: Stripe.Event) => Promise<void>> = {
  'checkout.session.completed': handleCheckoutCompleted,
  'invoice.paid': handleInvoicePaid,
  'invoice.payment_failed': handleInvoicePaymentFailed,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  'charge.refunded': handleChargeRefunded,
  'charge.dispute.created': handleDisputeCreated,
};

// ── POST /api/pagamento/webhook ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Fail-closed: require secret
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    apiLogger.error('STRIPE_WEBHOOK_SECRET is not set — rejecting webhook');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // 2. Require signature header
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // 3. Verify signature
  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    apiLogger.warn({ err }, 'Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // 4. Dedup
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
      },
    });
  } catch (err) {
    // Unique constraint violation = already processed
    const prismaErr = err as { code?: string };
    if (prismaErr?.code === 'P2002') {
      apiLogger.info({ eventId: event.id }, 'Webhook event already processed (dedup)');
      return NextResponse.json({ received: true });
    }
    throw err;
  }

  // 5. Ignored events
  if (IGNORED_EVENTS.has(event.type)) {
    apiLogger.debug({ eventType: event.type }, 'Ignored webhook event');
    return NextResponse.json({ received: true });
  }

  // 6. Dispatch to handler
  const handler = HANDLERS[event.type];
  if (!handler) {
    apiLogger.warn({ eventType: event.type }, 'Unknown webhook event type');
    return NextResponse.json({ received: true });
  }

  try {
    await handler(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    // Rollback dedup record on handler failure
    try {
      await prisma.processedWebhookEvent.delete({
        where: { stripeEventId: event.id },
      });
    } catch (rollbackErr) {
      apiLogger.error({ rollbackErr, eventId: event.id }, 'Failed to rollback dedup record');
    }

    apiLogger.error({ err, eventType: event.type, eventId: event.id }, 'Webhook handler error');
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
