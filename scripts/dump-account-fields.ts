/**
 * Dump dos campos relevantes de Account pra entender onde a Stripe guarda
 * os dados públicos em uma conta tipo `standard` (BR).
 */
import Stripe from 'stripe';

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acc = await (stripe.accounts as any).retrieve() as Stripe.Account;

  console.log('=== Top-level ===');
  console.log('email:', acc.email ?? '(null)');
  console.log('business_type:', acc.business_type ?? '(null)');
  console.log('country:', acc.country);

  console.log('\n=== business_profile ===');
  console.log(JSON.stringify(acc.business_profile, null, 2));

  console.log('\n=== company ===');
  console.log(JSON.stringify(acc.company, null, 2));

  console.log('\n=== settings.dashboard ===');
  console.log(JSON.stringify(acc.settings?.dashboard, null, 2));

  console.log('\n=== settings.branding ===');
  console.log(JSON.stringify(acc.settings?.branding, null, 2));

  console.log('\n=== settings.payments ===');
  console.log(JSON.stringify(acc.settings?.payments, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
