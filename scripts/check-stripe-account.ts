/**
 * Verifica se a conta Stripe está pronta pra LIVE mode.
 * Usa a chave (test ou live) pra retrieve da própria account — capabilities
 * e requirements são da conta toda, independente do modo da chave.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/check-stripe-account.ts
 */
import Stripe from 'stripe';

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não setada');
  const stripe = new Stripe(key);
  const keyMode = key.includes('_test_') ? 'TEST' : key.includes('_live_') ? 'LIVE' : '?';
  console.log(`\nUsando chave em modo ${keyMode}\n`);

  // SDK v22 tipa retrieve com id obrigatório; sem id, a API retorna a conta da própria chave.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe SDK type bug
  const acc = await (stripe.accounts as any).retrieve() as Stripe.Account;
  console.log(`Account ID:        ${acc.id}`);
  console.log(`Country:           ${acc.country}`);
  console.log(`Type:              ${acc.type}`);
  console.log(`Email:             ${acc.email ?? '(none)'}`);
  console.log(`Business name:     ${acc.business_profile?.name ?? '(none)'}`);
  console.log('');
  console.log('Status global:');
  console.log(`  charges_enabled:  ${acc.charges_enabled ? '✓' : '✗'}`);
  console.log(`  payouts_enabled:  ${acc.payouts_enabled ? '✓' : '✗'}`);
  console.log(`  details_submitted:${acc.details_submitted ? '✓' : '✗'}`);

  console.log('\nCapabilities:');
  const caps = acc.capabilities ?? {};
  for (const [name, status] of Object.entries(caps)) {
    const icon = status === 'active' ? '✓' : status === 'pending' ? '⏳' : '✗';
    console.log(`  ${icon} ${String(name).padEnd(30)} ${String(status)}`);
  }

  console.log('\nRequirements:');
  const req = acc.requirements;
  if (!req) {
    console.log('  (nada)');
  } else {
    const fmt = (arr?: string[] | null) => (arr && arr.length ? arr.join(', ') : '(vazio)');
    console.log(`  currently_due:    ${fmt(req.currently_due)}`);
    console.log(`  past_due:         ${fmt(req.past_due)}`);
    console.log(`  eventually_due:   ${fmt(req.eventually_due)}`);
    console.log(`  pending_verification: ${fmt(req.pending_verification)}`);
    console.log(`  disabled_reason:  ${req.disabled_reason ?? '(nenhum)'}`);
    if (req.current_deadline) {
      console.log(`  current_deadline: ${new Date(req.current_deadline * 1000).toISOString()}`);
    }
  }

  console.log('\nFuture requirements (alertas pra prazos futuros):');
  const fr = acc.future_requirements;
  if (!fr || (!fr.currently_due?.length && !fr.eventually_due?.length)) {
    console.log('  (nenhum)');
  } else {
    console.log(`  currently_due:    ${(fr.currently_due ?? []).join(', ') || '(vazio)'}`);
    console.log(`  eventually_due:   ${(fr.eventually_due ?? []).join(', ') || '(vazio)'}`);
  }

  console.log('');
  const ready =
    acc.charges_enabled &&
    acc.payouts_enabled &&
    acc.details_submitted &&
    !(req?.currently_due?.length) &&
    !(req?.past_due?.length) &&
    !req?.disabled_reason;

  if (ready) {
    console.log('✓✓✓ Conta pronta pra LIVE mode.');
  } else {
    console.log('⚠️  Conta ainda NÃO está totalmente liberada pra live. Veja flags acima.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
