/**
 * Remove dados de teste do banco de dados:
 * Documentos fictícios (apostilas, conteúdo programático, slides, bibliografias fake)
 *
 * Uso:
 *   npx tsx scripts/cleanup-test-data.ts --dry-run
 *   npx tsx scripts/cleanup-test-data.ts
 */

import { prisma } from '../lib/prisma';

const isDryRun = process.argv.includes('--dry-run');

// Padrões de título dos documentos fake visíveis no site
const fakeTitlePatterns = [
  'Apostila - Módulo',
  'Apostila Completa',
  'Conteúdo Programático -',
  'Conteúdo Programático do Curso',
  'Slides - Aula',
  'Bibliografia Recomendada -',
  'Bibliografia Completa do Curso',
  'Resumo Esquematizado -',
  'Modelo de Edital -',
];

async function main() {
  console.log(`=== Limpeza de Documentos Fictícios ===${isDryRun ? ' [DRY RUN]' : ''}\n`);

  // Buscar documentos que correspondem aos padrões fake
  const fakeDocs = await prisma.document.findMany({
    where: {
      OR: fakeTitlePatterns.map((pattern) => ({
        title: { startsWith: pattern },
      })),
    },
    select: { id: true, title: true, category: true, courseId: true },
    orderBy: [{ courseId: 'asc' }, { title: 'asc' }],
  });

  if (fakeDocs.length === 0) {
    console.log('Nenhum documento fictício encontrado.\n');
  } else {
    console.log(`${fakeDocs.length} documentos fictícios encontrados:\n`);
    let currentCourse = '';
    for (const doc of fakeDocs) {
      if (doc.courseId !== currentCourse) {
        currentCourse = doc.courseId || '(sem curso)';
        console.log(`  Curso ${currentCourse}:`);
      }
      console.log(`    - [${doc.category}] ${doc.title} (${doc.id})`);
    }

    if (!isDryRun) {
      const ids = fakeDocs.map((d) => d.id);
      const result = await prisma.document.deleteMany({
        where: { id: { in: ids } },
      });
      console.log(`\n  => ${result.count} documentos removidos (cascade: versões, chunks, notas)\n`);
    } else {
      console.log('\n  [DRY RUN] Nenhuma alteração feita.\n');
    }
  }

  // --- Resumo ---
  const totalDocs = await prisma.document.count();
  console.log(`--- Resumo ---`);
  console.log(`  Documentos restantes no banco: ${totalDocs}`);

  console.log('\nConcluído.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Erro:', e);
  await prisma.$disconnect();
  process.exit(1);
});
