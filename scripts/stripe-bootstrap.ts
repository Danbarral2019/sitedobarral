/**
 * Bootstrap de Products + Prices no Stripe.
 * Idempotente — usa lookup_key no Price para detectar existência.
 *
 * Uso (test mode):
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-bootstrap.ts
 *
 * Uso (live):
 *   STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe-bootstrap.ts
 */
import Stripe from 'stripe';

interface ProductDef {
  id: string;            // product ID estável (usamos como lookup_key do product)
  name: string;
  description: string;
}

interface PriceDef {
  lookupKey: string;
  productId: string;
  amountCents: number;
  interval: 'month' | 'year';
}

const PRODUCTS: ProductDef[] = [
  { id: 'prod_basico_sdb',  name: 'Plano Básico — Prof. Daniel Barral',  description: 'Acesso a 1 curso selecionado' },
  { id: 'prod_premium_sdb', name: 'Plano Premium — Prof. Daniel Barral', description: 'Acesso a todos os cursos + Assistente IA' },
];

const PRICES: PriceDef[] = [
  { lookupKey: 'basico_monthly',  productId: 'prod_basico_sdb',  amountCents: 4990,  interval: 'month' },
  { lookupKey: 'basico_yearly',   productId: 'prod_basico_sdb',  amountCents: 49900, interval: 'year'  },
  { lookupKey: 'premium_monthly', productId: 'prod_premium_sdb', amountCents: 8990,  interval: 'month' },
  { lookupKey: 'premium_yearly',  productId: 'prod_premium_sdb', amountCents: 89900, interval: 'year'  },
];

async function upsertProduct(stripe: Stripe, def: ProductDef): Promise<string> {
  try {
    const existing = await stripe.products.retrieve(def.id);
    await stripe.products.update(def.id, { name: def.name, description: def.description });
    console.log(`  ✓ Product ${def.id} atualizado`);
    return existing.id;
  } catch (err) {
    if ((err as { code?: string }).code === 'resource_missing') {
      const created = await stripe.products.create({
        id: def.id,
        name: def.name,
        description: def.description,
      });
      console.log(`  + Product ${def.id} criado`);
      return created.id;
    }
    throw err;
  }
}

async function upsertPrice(stripe: Stripe, def: PriceDef): Promise<void> {
  const existing = await stripe.prices.list({ lookup_keys: [def.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`  ✓ Price ${def.lookupKey} já existe (${existing.data[0].id})`);
    return;
  }
  const created = await stripe.prices.create({
    product: def.productId,
    unit_amount: def.amountCents,
    currency: 'brl',
    recurring: { interval: def.interval },
    lookup_key: def.lookupKey,
    transfer_lookup_key: true,
  });
  console.log(`  + Price ${def.lookupKey} criado (${created.id})`);
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY não definido');
    process.exit(1);
  }
  const stripe = new Stripe(key);
  const mode = key.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  console.log(`\nBootstrap Stripe — modo ${mode}\n`);

  console.log('Products:');
  for (const p of PRODUCTS) await upsertProduct(stripe, p);

  console.log('\nPrices:');
  for (const p of PRICES) await upsertPrice(stripe, p);

  console.log('\n✓ Bootstrap concluído\n');
}

main().catch((err) => {
  console.error('Falha no bootstrap:', err);
  process.exit(1);
});
