/**
 * Inventário rápido: quantos documentos há por categoria.
 * Usado para planejar reprocessamento em lote.
 */

import { prisma } from '../lib/prisma';

(async () => {
  const byCategory = await prisma.document.groupBy({
    by: ['category'],
    _count: { _all: true },
    orderBy: { _count: { category: 'desc' } },
  });

  const withSummary = await prisma.document.groupBy({
    by: ['category'],
    where: { summary: { not: null } },
    _count: { _all: true },
  });

  const withSummaryMap = new Map(withSummary.map(r => [r.category ?? '(null)', r._count._all]));

  console.log('Total por categoria e quantos já têm summary:');
  console.log('');
  console.log('Categoria'.padEnd(30) + ' | Total'.padEnd(10) + ' | Com summary');
  console.log('-'.repeat(60));
  for (const row of byCategory) {
    const cat = row.category ?? '(null)';
    const total = row._count._all;
    const done = withSummaryMap.get(cat) ?? 0;
    console.log(
      cat.padEnd(30) +
      ' | ' + total.toString().padStart(6) +
      ' | ' + done.toString().padStart(6) + ` (${Math.round(done/total*100)}%)`
    );
  }

  const legislativeActs = await prisma.legislativeAct.count();
  console.log('');
  console.log(`LegislativeAct (tabela separada): ${legislativeActs}`);

  await prisma.$disconnect();
})();
