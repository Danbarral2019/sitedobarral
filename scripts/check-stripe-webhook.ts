/**
 * Lista os webhook endpoints cadastrados no Stripe (no modo da chave usada) e
 * confere se cobrem os 7 eventos que o handler em app/api/pagamento/webhook
 * processa. Também imprime as payment method capabilities da conta (incluindo
 * pix_payments), porque o checkout oferece PIX nativo.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/check-stripe-webhook.ts
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
];

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não setada');
  const stripe = new Stripe(key);
  const mode = key.includes('_test_') ? 'TEST' : key.includes('_live_') ? 'LIVE' : '?';
  console.log(`\nWebhook endpoints — modo ${mode}\n`);

  const list = await stripe.webhookEndpoints.list({ limit: 100 });
  if (!list.data.length) {
    console.log('✗ Nenhum webhook endpoint cadastrado neste modo.');
  }
  for (const ep of list.data) {
    console.log(`Endpoint: ${ep.url}`);
    console.log(`  id:      ${ep.id}`);
    console.log(`  status:  ${ep.status}`);
    const enabled = ep.enabled_events;
    const all = enabled.includes('*');
    console.log(`  events:  ${all ? '* (todos)' : enabled.length + ' eventos'}`);
    const missing = all ? [] : EXPECTED_EVENTS.filter((e) => !enabled.includes(e));
    if (missing.length) {
      console.log(`  ⚠️  faltam: ${missing.join(', ')}`);
    } else {
      console.log('  ✓ cobre os 7 eventos esperados');
    }
    console.log('');
  }

  // Capabilities de meio de pagamento — confirma se PIX está ativo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe SDK type bug (retrieve sem id)
  const acc = (await (stripe.accounts as any).retrieve()) as Stripe.Account;
  const caps = acc.capabilities ?? {};
  console.log('Payment capabilities relevantes:');
  for (const name of ['card_payments', 'pix_payments', 'boleto_payments']) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (caps as any)[name] ?? '(não solicitada)';
    const icon = status === 'active' ? '✓' : status === 'pending' ? '⏳' : '✗';
    console.log(`  ${icon} ${name.padEnd(18)} ${status}`);
  }
  if (!('pix_payments' in caps)) {
    console.log('\n  ⚠️  pix_payments NÃO está nas capabilities. O checkout oferece PIX —');
    console.log('     se a capability não estiver active, a sessão PIX falha. Solicitar no');
    console.log('     dashboard (Settings → Payment methods → Pix) ou via API.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
