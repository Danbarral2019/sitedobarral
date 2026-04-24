/**
 * Confirma que os 4 lookup_keys esperados pelo código existem e estão
 * ativos no Stripe. Resolve via `prices.list({ lookup_keys: [...] })`
 * exatamente como `resolvePriceId` em lib/stripe.ts faz.
 */
import Stripe from 'stripe';

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não setada');
  const stripe = new Stripe(key);
  const keys = ['basico_monthly', 'basico_yearly', 'premium_monthly', 'premium_yearly'];
  let missing = 0;
  for (const k of keys) {
    const r = await stripe.prices.list({ lookup_keys: [k], active: true, limit: 1 });
    const p = r.data[0];
    if (p) {
      const interval = p.recurring?.interval ?? '?';
      const amount = (p.unit_amount ?? 0) / 100;
      console.log(`OK    ${k.padEnd(18)} → R$ ${amount.toFixed(2).padStart(7)} / ${interval}   (${p.id})`);
    } else {
      console.log(`FALTA ${k}`);
      missing++;
    }
  }
  console.log('');
  console.log(missing === 0 ? '✓ Todos os 4 lookup_keys resolvidos.' : `✗ Faltam ${missing}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
