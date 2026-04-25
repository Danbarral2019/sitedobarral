import Stripe from 'stripe';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const evs = await s.events.list({ limit: 50 });
  console.log(`Últimos ${evs.data.length} eventos (qualquer tipo):`);
  for (const ev of evs.data) {
    const obj = ev.data.object as Record<string, unknown>;
    const tag = obj.id ? `obj=${obj.id}` : '';
    console.log(`  - ${new Date(ev.created * 1000).toISOString()}  ${ev.type.padEnd(40)}  ${ev.id}  ${tag}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
