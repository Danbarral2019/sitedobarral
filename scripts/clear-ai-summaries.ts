/**
 * Limpa os campos `summary`, `summaryHighlights`, `summaryGeneratedAt`
 * (gerados por IA via /api/admin/documents/[id]/generate-summary) de TODOS
 * os documentos da base de conhecimento.
 *
 * Política: nenhum item da base é exibido como reescrita IA. Texto-fonte e
 * curadoria didática (description, notes.*) ficam intactos. Ver
 * `lib/literal-sources.ts` para o racional.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/clear-ai-summaries.ts            # dry-run (default)
 *   npx dotenv -e .env.local -- npx tsx scripts/clear-ai-summaries.ts --apply    # aplica
 */

import { prisma } from '../lib/prisma';

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('=== Cleanup: summary IA em TODA a base de conhecimento ===');
  console.log(`Modo: ${apply ? 'APPLY (escreve no banco)' : 'DRY-RUN (somente conta)'}`);
  console.log('');

  const where = {
    OR: [
      { summary: { not: null } },
      { summaryHighlights: { not: null } },
      { summaryGeneratedAt: { not: null } },
    ],
  };

  const totalDocs = await prisma.document.count();
  const affected = await prisma.document.count({ where });

  console.log(`Documentos na base: ${totalDocs}`);
  console.log(`Documentos com summary IA populado: ${affected}`);

  if (affected === 0) {
    console.log('\nNada a limpar. Saindo.');
    return;
  }

  // Distribuição por categoria
  type Row = { category: string; count: bigint };
  const dist = await prisma.$queryRaw<Row[]>`
    SELECT "category", COUNT(*)::bigint AS count
    FROM "Document"
    WHERE "summary" IS NOT NULL
       OR "summaryHighlights" IS NOT NULL
       OR "summaryGeneratedAt" IS NOT NULL
    GROUP BY "category"
    ORDER BY COUNT(*) DESC
  `;

  console.log('\nDistribuição por categoria:');
  for (const r of dist) {
    console.log(`  ${r.category.padEnd(28)} ${String(Number(r.count)).padStart(6)}`);
  }

  // Amostra dos primeiros 3
  const sample = await prisma.document.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      summary: true,
    },
    take: 3,
    orderBy: { uploadedAt: 'desc' },
  });

  console.log('\nAmostra (3 mais recentes):');
  for (const d of sample) {
    const desc = (d.description ?? '').replace(/\s+/g, ' ').slice(0, 100);
    const sum = (d.summary ?? '').replace(/\s+/g, ' ').slice(0, 100);
    const isCopia = (d.description ?? '').trim() === (d.summary ?? '').trim();
    console.log(`  - [${d.category}] ${d.title.slice(0, 70)}`);
    console.log(`    description: "${desc}…"`);
    console.log(`    summary    : "${sum}…" ${isCopia ? '(== description)' : '(!= description)'}`);
  }

  if (!apply) {
    console.log('\n(dry-run — nada foi alterado. Re-executar com --apply para limpar.)');
    return;
  }

  const result = await prisma.document.updateMany({
    where,
    data: {
      summary: null,
      summaryHighlights: null,
      summaryGeneratedAt: null,
      summaryEditedByAdmin: false,
    },
  });

  console.log(`\n✅ Limpeza concluída. Linhas atualizadas: ${result.count}`);
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
