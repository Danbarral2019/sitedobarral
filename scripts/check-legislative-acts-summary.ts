import { prisma } from '../lib/prisma';

(async () => {
  const total = await prisma.legislativeAct.count();
  const withSummary = await prisma.legislativeAct.count({ where: { summary: { not: null } } });
  console.log(`LegislativeAct: ${withSummary}/${total} com summary (${Math.round(withSummary/total*100)}%)`);
  await prisma.$disconnect();
})();
