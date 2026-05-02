import { prisma } from '../lib/prisma';

async function main() {
  const sends = await prisma.newsletterSend.findMany({
    where: { totalFailed: { gt: 0 } },
    select: {
      sentAt: true, type: true, subject: true,
      totalSent: true, totalFailed: true,
    },
    orderBy: { sentAt: 'desc' },
  });
  console.log(`Sends com ao menos 1 falha: ${sends.length}\n`);
  let sumFailed = 0;
  for (const s of sends) {
    sumFailed += s.totalFailed;
    console.log(`  ${s.sentAt.toISOString().slice(0, 10)} [${s.type}] sent=${s.totalSent} failed=${s.totalFailed}`);
    console.log(`    "${s.subject?.slice(0, 80)}"`);
  }
  console.log(`\nSoma de falhas: ${sumFailed}`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
