/**
 * Valida ponta-a-ponta o teste E2E de assinatura+cancel pra aluno@teste.com.
 * Lê do DB + da API Stripe. Só leitura.
 */
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';

const TEST_EMAIL = 'aluno@teste.com';

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não setada');
  const stripe = new Stripe(key);

  console.log(`\n=== Verificação E2E — ${TEST_EMAIL} ===\n`);

  // 1) Usuário no DB
  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });
  if (!user) {
    console.error('✗ Usuário não encontrado no DB');
    process.exit(1);
  }
  console.log('User:');
  console.log(`  id:               ${user.id}`);
  console.log(`  stripeCustomerId: ${user.stripeCustomerId ?? '(null — ensureStripeCustomer não rodou?)'}`);

  // 2) Subscriptions no DB
  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`\nSubscriptions no DB (${subs.length}):`);
  for (const s of subs) {
    console.log(`  - id=${s.id}`);
    console.log(`    stripeSubscriptionId=${s.stripeSubscriptionId}`);
    console.log(`    plan=${s.plan} billingCycle=${s.billingCycle} courseId=${s.courseId ?? '-'}`);
    console.log(`    status=${s.status} cancelAtPeriodEnd=${s.cancelAtPeriodEnd}`);
    console.log(`    currentPeriodEnd=${s.currentPeriodEnd?.toISOString() ?? '-'}`);
    console.log(`    created=${s.createdAt.toISOString()} updated=${s.updatedAt.toISOString()}`);
  }

  // 3) Enrollments no DB
  const enrolls = await prisma.enrollment.findMany({
    where: { userId: user.id },
    orderBy: { enrolledAt: 'desc' },
  });
  console.log(`\nEnrollments no DB (${enrolls.length}):`);
  for (const e of enrolls) {
    console.log(`  - courseId=${e.courseId} expiresAt=${e.expiresAt?.toISOString() ?? 'null (sem expiração)'} qrCodeId=${e.qrCodeId ?? '-'} enrolled=${e.enrolledAt.toISOString()}`);
  }

  // 4) ProcessedWebhookEvent recentes (últimos 10)
  const events = await prisma.processedWebhookEvent.findMany({
    orderBy: { processedAt: 'desc' },
    take: 10,
  });
  console.log(`\nProcessedWebhookEvent (10 mais recentes — comprova idempotência):`);
  for (const ev of events) {
    console.log(`  - ${ev.processedAt.toISOString()}  ${ev.eventType.padEnd(40)}  ${ev.stripeEventId}`);
  }

  // 5) Stripe-side: customer
  if (!user.stripeCustomerId) {
    console.log('\n(sem stripeCustomerId, pulando consultas na Stripe)');
    await prisma.$disconnect();
    return;
  }

  const customer = await stripe.customers.retrieve(user.stripeCustomerId);
  console.log(`\nStripe Customer:`);
  if ((customer as Stripe.Customer).deleted) {
    console.log('  ✗ deletado');
  } else {
    const c = customer as Stripe.Customer;
    console.log(`  id=${c.id} email=${c.email} name=${c.name ?? '-'} created=${new Date(c.created * 1000).toISOString()}`);
    console.log(`  metadata.userId=${c.metadata?.userId ?? '-'}`);
  }

  // 6) Subscriptions no Stripe
  const stripeSubs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 10 });
  console.log(`\nSubscriptions no Stripe (${stripeSubs.data.length}):`);
  for (const s of stripeSubs.data) {
    const item = s.items.data[0];
    // current_period_end agora vive no item (Stripe SDK v22)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cpe = (item as any).current_period_end as number | undefined;
    console.log(`  - ${s.id} status=${s.status} cancel_at_period_end=${s.cancel_at_period_end}`);
    console.log(`    price.lookup_key=${item?.price?.lookup_key ?? '-'} amount=${(item?.price?.unit_amount ?? 0) / 100}/${item?.price?.recurring?.interval ?? '-'}`);
    console.log(`    current_period_end=${cpe ? new Date(cpe * 1000).toISOString() : '-'}`);
    console.log(`    canceled_at=${s.canceled_at ? new Date(s.canceled_at * 1000).toISOString() : '-'}`);
    console.log(`    metadata.userId=${s.metadata?.userId ?? '-'} metadata.plan=${s.metadata?.plan ?? '-'} metadata.billingCycle=${s.metadata?.billingCycle ?? '-'}`);
  }

  // 7) Eventos recentes na conta Stripe envolvendo esse customer
  const recentEvents = await stripe.events.list({ limit: 30 });
  const relevant = recentEvents.data.filter((ev) => {
    const obj = ev.data.object as Record<string, unknown>;
    if (obj.customer === user.stripeCustomerId) return true;
    if (obj.id && stripeSubs.data.some((s) => s.id === obj.id)) return true;
    return false;
  });
  console.log(`\nEventos Stripe recentes envolvendo este customer/subscriptions (${relevant.length} de ${recentEvents.data.length}):`);
  for (const ev of relevant) {
    console.log(`  - ${new Date(ev.created * 1000).toISOString()}  ${ev.type.padEnd(40)}  ${ev.id}`);
  }

  // 8) Endpoints de webhook + última entrega
  const endpoints = await stripe.webhookEndpoints.list({ limit: 5 });
  console.log(`\nWebhook endpoints (${endpoints.data.length}):`);
  for (const ep of endpoints.data) {
    console.log(`  - ${ep.url}  status=${ep.status}  events=${ep.enabled_events.length}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
