/**
 * Audita o uso do campo Document.summary (gerado por IA) por categoria.
 *
 * Política atual (ver lib/literal-sources.ts): TODA a base é tratada como
 * literal — `summary` IA é bloqueado para qualquer categoria. Este script
 * existe para detectar regressões (rows com summary populado depois do
 * cleanup) e diagnosticar drift.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-summaries.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-summaries.ts --sample 3   # mostra 3 amostras por categoria
 */

import { prisma } from '../lib/prisma';

async function main() {
  const args = process.argv.slice(2);
  const sampleIdx = args.indexOf('--sample');
  const sampleSize = sampleIdx >= 0 ? parseInt(args[sampleIdx + 1] ?? '0', 10) : 0;

  console.log('=== Auditoria: Document.summary por categoria ===');
  console.log('Política: toda categoria é literal — qualquer linha aqui com c/Summary > 0 é regressão.');
  console.log('');

  type Row = { category: string; total: bigint; comSummary: bigint };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      "category",
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "summary" IS NOT NULL)::bigint AS "comSummary"
    FROM "Document"
    GROUP BY "category"
    ORDER BY COUNT(*) FILTER (WHERE "summary" IS NOT NULL) DESC, "category" ASC
  `;

  const header = 'Categoria'.padEnd(28) + 'Total'.padStart(8) + 'c/Summary'.padStart(12) + '   %';
  console.log(header);
  console.log('-'.repeat(header.length + 4));

  for (const r of rows) {
    const total = Number(r.total);
    const comSum = Number(r.comSummary);
    const pct = total > 0 ? ((comSum / total) * 100).toFixed(0) + '%' : '0%';
    const tag = comSum > 0 ? ' [REGRESSÃO]' : '';
    console.log(
      r.category.padEnd(28) +
      String(total).padStart(8) +
      String(comSum).padStart(12) +
      '  '.padStart(2) + pct.padStart(4) +
      tag
    );
  }

  if (sampleSize > 0) {
    console.log('\n=== Amostras de summary por categoria ===');
    const cats = rows.filter(r => Number(r.comSummary) > 0).map(r => r.category);
    for (const cat of cats) {
      const samples = await prisma.document.findMany({
        where: { category: cat, summary: { not: null } },
        select: {
          id: true,
          title: true,
          description: true,
          summary: true,
        },
        take: sampleSize,
        orderBy: { uploadedAt: 'desc' },
      });
      console.log(`\n--- ${cat} ---`);
      for (const s of samples) {
        const desc = (s.description ?? '').replace(/\s+/g, ' ').slice(0, 140);
        const sum = (s.summary ?? '').replace(/\s+/g, ' ').slice(0, 140);
        console.log(`  ${s.title}`);
        console.log(`    description: "${desc}…"`);
        console.log(`    summary    : "${sum}…"`);
      }
    }
  } else {
    console.log('\n(Use --sample N para inspecionar N exemplos por categoria.)');
  }
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
