import Stripe from 'stripe';

const EVENT_ID = process.argv[2] ?? 'evt_1TQ4aJRxghwDELSurW9R2hod';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const ev = await s.events.retrieve(EVENT_ID);
  console.log(`Event: ${ev.id}  type=${ev.type}  created=${new Date(ev.created * 1000).toISOString()}`);
  const obj = ev.data.object as Stripe.Subscription;
  console.log('  status:               ', obj.status);
  console.log('  cancel_at_period_end: ', obj.cancel_at_period_end);
  console.log('  cancel_at:            ', obj.cancel_at ? new Date(obj.cancel_at * 1000).toISOString() : '-');
  console.log('  canceled_at:          ', obj.canceled_at ? new Date(obj.canceled_at * 1000).toISOString() : '-');
  console.log('  cancellation_details: ', JSON.stringify(obj.cancellation_details));
  const prev = ev.data.previous_attributes as Record<string, unknown> | undefined;
  if (prev) {
    console.log('  previous_attributes:  ', JSON.stringify(prev, null, 2));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
