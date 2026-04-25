/**
 * Verifica a configuração ativa do Customer Billing Portal no Stripe.
 *
 * Lista a configuração default ativa (a usada por createBillingPortalSession()
 * quando não passamos `configuration` explícito), imprime quais features estão
 * ON/OFF, valida o modo de cancelamento e o link de redirecionamento default.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/check-stripe-portal.ts
 */
import Stripe from 'stripe';

function bool(v: boolean): string {
  return v ? 'ON ' : 'off';
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não setada');
  const stripe = new Stripe(key);
  const mode = key.includes('_test_') ? 'TEST' : key.includes('_live_') ? 'LIVE' : '?';
  console.log(`\nCustomer Billing Portal — modo ${mode}\n`);

  const list = await stripe.billingPortal.configurations.list({ active: true, is_default: true, limit: 1 });
  const cfg = list.data[0];
  if (!cfg) {
    console.error('✗ Nenhuma configuração ativa default encontrada. Habilite o portal no dashboard e salve.');
    process.exit(1);
  }

  console.log(`Config ID: ${cfg.id}`);
  console.log(`Default:   ${cfg.is_default}`);
  console.log(`Active:    ${cfg.active}`);
  console.log(`Default return URL: ${cfg.default_return_url ?? '(none)'}`);
  console.log(`Headline:           ${cfg.business_profile?.headline ?? '(none)'}`);
  console.log(`Terms of service:   ${cfg.business_profile?.terms_of_service_url ?? '(none)'}`);
  console.log(`Privacy policy:     ${cfg.business_profile?.privacy_policy_url ?? '(none)'}`);

  const f = cfg.features;
  console.log('\nFeatures:');
  console.log(`  invoice_history             ${bool(f.invoice_history.enabled)}`);
  console.log(`  customer_update             ${bool(f.customer_update.enabled)}  allowed=[${f.customer_update.allowed_updates.join(', ')}]`);
  console.log(`  payment_method_update       ${bool(f.payment_method_update.enabled)}`);
  console.log(`  subscription_cancel         ${bool(f.subscription_cancel.enabled)}  mode=${f.subscription_cancel.mode}  proration=${f.subscription_cancel.proration_behavior}`);
  console.log(`  subscription_update         ${bool(f.subscription_update.enabled)}`);
  // subscription_pause foi removido do tipo Features no SDK v22; acesso defensivo via cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe SDK type drift
  const pauseEnabled = ((f as any).subscription_pause?.enabled ?? false) as boolean;
  console.log(`  subscription_pause          ${bool(pauseEnabled)}`);

  const issues: string[] = [];
  if (!f.invoice_history.enabled) issues.push('invoice_history desligado');
  if (!f.customer_update.enabled) issues.push('customer_update desligado');
  if (!f.payment_method_update.enabled) issues.push('payment_method_update desligado');
  if (!f.subscription_cancel.enabled) issues.push('subscription_cancel desligado');
  if (f.subscription_cancel.enabled && f.subscription_cancel.mode !== 'at_period_end') {
    issues.push(`subscription_cancel.mode=${f.subscription_cancel.mode} (esperado: at_period_end — alinha com nosso webhook customer.subscription.deleted)`);
  }
  if (pauseEnabled) issues.push('subscription_pause LIGADO sem handler no webhook');

  console.log('');
  if (issues.length === 0) {
    console.log('✓ Configuração ok pra o que o app espera.');
  } else {
    console.log('⚠️  Avisos:');
    for (const i of issues) console.log('   - ' + i);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
