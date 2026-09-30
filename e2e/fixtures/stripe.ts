import { randomBytes } from 'node:crypto';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import Stripe from 'stripe';
import { E2E_STRIPE_OFFLINE_KEY, E2E_STRIPE_WEBHOOK_SECRET } from './database';

// Só usado para assinar payloads localmente; nenhuma chamada sai por ele.
const assinador = new Stripe(E2E_STRIPE_OFFLINE_KEY);

export function stripeId(prefixo: string): string {
  return `${prefixo}_e2e_${randomBytes(6).toString('hex')}`;
}

export interface StripeTestEvent {
  id: string;
  type: string;
  object: Record<string, unknown>;
}

export function buildEvent(type: string, object: Record<string, unknown>): StripeTestEvent {
  return { id: stripeId('evt'), type, object };
}

function serialize(event: StripeTestEvent): string {
  return JSON.stringify({
    id: event.id,
    object: 'event',
    api_version: '2025-01-27.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type: event.type,
    data: { object: event.object },
  });
}

export async function postWebhook(
  request: APIRequestContext,
  event: StripeTestEvent,
  options: { secret?: string } = {},
): Promise<APIResponse> {
  const payload = serialize(event);
  const signature = assinador.webhooks.generateTestHeaderString({
    payload,
    secret: options.secret ?? E2E_STRIPE_WEBHOOK_SECRET,
  });
  return request.post('/api/pagamento/webhook', {
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    data: payload,
  });
}

export function checkoutCompleted(params: {
  userId: string;
  plan: 'basico' | 'premium';
  subscriptionId: string;
  customerId: string;
  courseId?: string;
}): StripeTestEvent {
  return buildEvent('checkout.session.completed', {
    id: stripeId('cs'),
    object: 'checkout.session',
    mode: 'subscription',
    // Formato real da assinatura por cartão: a Stripe só conclui a sessão
    // depois de cobrar a primeira fatura, e o webhook só libera acesso com
    // payment_status 'paid' (ou 'no_payment_required').
    status: 'complete',
    payment_status: 'paid',
    customer: params.customerId,
    subscription: params.subscriptionId,
    payment_method_types: ['card'],
    metadata: {
      userId: params.userId,
      plan: params.plan,
      billingCycle: 'monthly',
      ...(params.courseId ? { courseId: params.courseId } : {}),
    },
  });
}

function invoice(subscriptionId: string): Record<string, unknown> {
  return {
    id: stripeId('in'),
    object: 'invoice',
    amount_paid: 8990,
    currency: 'brl',
    hosted_invoice_url: null,
    parent: { type: 'subscription_details', subscription_details: { subscription: subscriptionId } },
  };
}

export function invoicePaid(subscriptionId: string): StripeTestEvent {
  return buildEvent('invoice.paid', invoice(subscriptionId));
}

export function invoicePaymentFailed(subscriptionId: string): StripeTestEvent {
  return buildEvent('invoice.payment_failed', invoice(subscriptionId));
}

export function subscriptionDeleted(subscriptionId: string): StripeTestEvent {
  return buildEvent('customer.subscription.deleted', {
    id: subscriptionId,
    object: 'subscription',
    status: 'canceled',
  });
}
