import Stripe from 'stripe';

const SUB_ID = 'sub_1TQ4Z2RxghwDELSuGASjM5oc';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sub = await s.subscriptions.retrieve(SUB_ID);
  console.log('SUB DIRECT RETRIEVE:');
  console.log('  status:               ', sub.status);
  console.log('  cancel_at_period_end: ', sub.cancel_at_period_end);
  console.log('  canceled_at:          ', sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : '-');
  console.log('  cancel_at:            ', sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : '-');
  console.log('  cancellation_details: ', JSON.stringify(sub.cancellation_details));

  const evs = await s.events.list({ limit: 30, type: 'customer.subscription.updated' });
  console.log(`\nÚltimos ${Math.min(10, evs.data.length)} eventos customer.subscription.updated (qualquer customer):`);
  for (const ev of evs.data.slice(0, 10)) {
    const obj = ev.data.object as Stripe.Subscription;
    console.log(`  - ${new Date(ev.created * 1000).toISOString()}  ${ev.id}  sub=${obj.id}  cape=${obj.cancel_at_period_end}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
