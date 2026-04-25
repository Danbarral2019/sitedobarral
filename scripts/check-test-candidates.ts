/**
 * Lista contexto pra escolher um usuário de teste seguro pro fluxo Stripe E2E.
 * Só leitura. Pode deletar depois do teste.
 */
import { prisma } from '../lib/prisma';

async function main() {
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ['active', 'trialing', 'processing', 'past_due'] } },
    select: { userId: true, status: true, plan: true, stripeSubscriptionId: true, currentPeriodEnd: true },
  });
  console.log('Subscriptions ativas no DB:', subs.length);
  for (const s of subs) {
    console.log(`  - userId=${s.userId} status=${s.status} plan=${s.plan} stripeSub=${s.stripeSubscriptionId} end=${s.currentPeriodEnd?.toISOString() ?? '-'}`);
  }

  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { email: true, name: true },
  });
  console.log('\nAdmins:', admins.length);
  for (const u of admins) console.log(`  - ${u.email} | ${u.name}`);

  const total = await prisma.user.count();
  console.log('\nTotal de usuários:', total);

  const recent = await prisma.user.findMany({
    where: { role: { not: 'admin' } },
    select: { id: true, email: true, name: true, createdAt: true, emailVerified: true, stripeCustomerId: true },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
  console.log('\nUsuários não-admin (recentes primeiro):');
  for (const u of recent) {
    const verified = u.emailVerified ? '✓' : '·';
    const hasCust = u.stripeCustomerId ? `[stripe=${u.stripeCustomerId}]` : '';
    console.log(`  ${verified} ${u.email.padEnd(40)} | ${(u.name ?? '').padEnd(25)} | ${u.createdAt.toISOString().slice(0, 10)} ${hasCust}`);
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
