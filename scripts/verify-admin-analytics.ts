import { prisma } from '../lib/prisma';

async function main() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const counts = await prisma.$queryRaw<
    Array<{ feedback: number | null; count: number }>
  >`
    SELECT feedback, COUNT(*)::int as count
    FROM "SearchHistory"
    WHERE "createdAt" >= ${since}
    GROUP BY feedback
  `;
  console.log('feedbackCounts:', counts);

  const topNegative = await prisma.$queryRaw<
    Array<{ query: string; count: number; type: string }>
  >`
    SELECT LOWER(TRIM(query)) as query, COUNT(*)::int as count, MAX(type) as type
    FROM "SearchHistory"
    WHERE "createdAt" >= ${since} AND feedback = -1
    GROUP BY LOWER(TRIM(query))
    ORDER BY count DESC LIMIT 5
  `;
  console.log('negativeFeedbackTop:', topNegative);

  const recent = await prisma.searchHistory.findMany({
    where: { createdAt: { gte: since }, feedback: -1 },
    select: { id: true, type: true, query: true, filters: true, feedbackAt: true },
    orderBy: { feedbackAt: 'desc' },
    take: 5,
  });
  console.log('negativeFeedbackRecent:');
  for (const r of recent) {
    console.log(' ', r.id.slice(0, 8), '|', r.type, '|', r.query.slice(0, 60), '|', r.filters, '|', r.feedbackAt?.toISOString());
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
