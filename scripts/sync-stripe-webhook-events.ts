/**
 * Garante (idempotente) que o webhook endpoint do app tenha exatamente os 7
 * eventos que o handler em app/api/pagamento/webhook processa. Preserva eventos
 * extras já cadastrados (faz union) e NÃO altera o signing secret do endpoint
 * — ou seja, STRIPE_WEBHOOK_SECRET continua válido.
 *
 * Roda no modo da chave usada (test ou live). Use --dry-run pra só ver o diff.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-stripe-webhook-events.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-stripe-webhook-events.ts
 */
import Stripe from 'stripe';

const EXPECTED_EVENTS = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.refunded',
  'charge.dispute.created',
] as const;

const ENDPOINT_PATH = '/api/pagamento/webhook';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não setada');
  const stripe = new Stripe(key);
  const mode = key.includes('_test_') ? 'TEST' : key.includes('_live_') ? 'LIVE' : '?';
  console.log(`\nSync webhook events — modo ${mode}${dryRun ? ' (dry-run)' : ''}\n`);

  const list = await stripe.webhookEndpoints.list({ limit: 100 });
  const target = list.data.find((ep) => ep.url.includes(ENDPOINT_PATH));
  if (!target) {
    throw new Error(`Nenhum endpoint apontando para ${ENDPOINT_PATH} encontrado neste modo.`);
  }

  console.log(`Endpoint: ${target.url}`);
  console.log(`  id:      ${target.id}`);

  const current = target.enabled_events;
  if (current.includes('*')) {
    console.log('  events:  * (todos) — nada a fazer.');
    return;
  }

  const missing = EXPECTED_EVENTS.filter((e) => !current.includes(e));
  const union = Array.from(new Set([...current, ...EXPECTED_EVENTS])).sort();

  console.log(`  atuais:  ${current.length} eventos`);
  if (!missing.length) {
    console.log('  ✓ já cobre os 7 eventos esperados — nada a fazer.');
    return;
  }
  console.log(`  faltam:  ${missing.join(', ')}`);
  console.log(`  → final: ${union.length} eventos (union, preservando extras)`);

  if (dryRun) {
    console.log('\n(dry-run) nenhuma alteração feita.');
    return;
  }

  const updated = await stripe.webhookEndpoints.update(target.id, {
    enabled_events: union as Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
  });
  console.log(`\n✓ Atualizado. Agora com ${updated.enabled_events.length} eventos.`);
  const stillMissing = EXPECTED_EVENTS.filter((e) => !updated.enabled_events.includes(e));
  console.log(stillMissing.length ? `⚠️  ainda faltam: ${stillMissing.join(', ')}` : '✓ os 7 eventos esperados estão cobertos.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
