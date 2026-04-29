/**
 * Limpa os campos `summary`, `summaryHighlights`, `summaryGeneratedAt` apenas
 * para documentos em LITERAL_SOURCE_CATEGORIES (atualmente: enunciados).
 *
 * Para essas categorias, summary IA é alucinação por design (incidente IBDA 29).
 * Para outras categorias, summary IA é admissível e não deve ser limpo.
 * Ver lib/literal-sources.ts.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/clear-ai-summaries.ts            # dry-run (default)
 *   npx dotenv -e .env.local -- npx tsx scripts/clear-ai-summaries.ts --apply    # aplica
 */

import { prisma } from '../lib/prisma';
import { LITERAL_SOURCE_CATEGORIES } from '../lib/literal-sources';

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('=== Cleanup: summary IA em fontes literais ===');
  console.log(`Categorias afetadas: ${LITERAL_SOURCE_CATEGORIES.join(', ')}`);
  console.log(`Modo: ${apply ? 'APPLY (escreve no banco)' : 'DRY-RUN (somente conta)'}`);
  console.log('');

  const where = {
    category: { in: [...LITERAL_SOURCE_CATEGORIES] },
    OR: [
      { summary: { not: null } },
      { summaryHighlights: { not: null } },
      { summaryGeneratedAt: { not: null } },
    ],
  };

  const total = await prisma.document.count({
    where: { category: { in: [...LITERAL_SOURCE_CATEGORIES] } },
  });
  const affected = await prisma.document.count({ where });

  console.log(`Documentos nas categorias literais: ${total}`);
  console.log(`Documentos com summary populado: ${affected}`);

  if (affected === 0) {
    console.log('\nNada a limpar. Saindo.');
    return;
  }

  const sample = await prisma.document.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      entityType: true,
      enunciadoNumber: true,
      summary: true,
    },
    take: 5,
    orderBy: { uploadedAt: 'desc' },
  });

  console.log('\nAmostra (5 mais recentes):');
  for (const d of sample) {
    const head = (d.summary ?? '').replace(/\s+/g, ' ').slice(0, 120);
    console.log(`  - [${d.category}/${d.entityType ?? '?'} #${d.enunciadoNumber ?? '?'}] ${d.title}`);
    console.log(`    summary: "${head}${(d.summary ?? '').length > 120 ? '…' : ''}"`);
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
