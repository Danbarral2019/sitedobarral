/**
 * Cria (idempotente) o webhook endpoint do app no modo da chave usada, já com os
 * 7 eventos que app/api/pagamento/webhook processa. Na criação, grava o signing
 * secret em .whsec.tmp em vez de imprimi-lo (o secret permite forjar eventos —
 * não deve aparecer em logs). Se o endpoint já existe, não recria (o secret de um
 * endpoint existente não é recuperável via API — rotacione no dashboard).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/create-stripe-webhook.ts
 */
import Stripe from 'stripe';
import { writeFileSync } from 'fs';

const URL = 'https://www.profdanielbarral.com/api/pagamento/webhook';
const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.refunded',
  'charge.dispute.created',
];

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não setada');
  const stripe = new Stripe(key);
  const mode = key.startsWith('sk_live_') ? 'LIVE' : 'TEST';

  const list = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = list.data.find((e) => e.url === URL);
  if (existing) {
    console.log(`JA_EXISTE id=${existing.id} status=${existing.status} eventos=${existing.enabled_events.length}`);
    console.log('Secret de endpoint existente não é recuperável via API. Rotacione no dashboard se precisar.');
    return;
  }

  const ep = await stripe.webhookEndpoints.create({ url: URL, enabled_events: EVENTS });
  writeFileSync('.whsec.tmp', ep.secret ?? '', 'utf8');
  console.log(`CRIADO modo=${mode} id=${ep.id} status=${ep.status} eventos=${ep.enabled_events.length}`);
  console.log('Signing secret gravado em .whsec.tmp (não exibido).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
