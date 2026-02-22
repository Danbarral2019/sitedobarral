/**
 * Limpeza de acórdãos TCU irrelevantes
 *
 * Remove acórdãos de áreas não relacionadas a licitações/contratos (Pessoal,
 * Responsabilidade, Direito Processual, Competência do TCU) que são isCommon=true
 * (sem courseId definido).
 *
 * Acórdãos com courseId definido NÃO são removidos, mesmo em áreas "irrelevantes",
 * pois foram deliberadamente associados a um curso.
 *
 * Uso:
 *   cd sitedobarral
 *   npx tsx scripts/cleanup-tcu-irrelevant.ts --dry-run    # Simular
 *   npx tsx scripts/cleanup-tcu-irrelevant.ts              # Executar
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- Parse CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// --- Áreas irrelevantes para licitações/contratos ---
const AREAS_IRRELEVANTES = [
  'Pessoal',
  'Responsabilidade',
  'Direito Processual',
  'Competência do TCU',
];

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          LIMPEZA DE ACÓRDÃOS TCU IRRELEVANTES              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 MODO DRY-RUN: nenhuma alteração será feita\n');
  }

  // 1. Estatísticas iniciais
  const totalAcordaos = await prisma.document.count({
    where: { category: 'acordao' },
  });

  const totalChunks = await prisma.documentChunk.count({
    where: { document: { category: 'acordao' } },
  });

  console.log(`📊 Estado atual:`);
  console.log(`   Total de acórdãos: ${totalAcordaos}`);
  console.log(`   Total de chunks: ${totalChunks}`);
  console.log('');

  // 2. Contar acórdãos por área irrelevante
  console.log('📋 Acórdãos por área irrelevante:');
  for (const area of AREAS_IRRELEVANTES) {
    const count = await prisma.document.count({
      where: {
        category: 'acordao',
        isCommon: true,
        courseId: null,
        tcuArea: area,
      },
    });
    console.log(`   ${area}: ${count}`);
  }
  console.log('');

  // 3. Buscar IDs dos acórdãos a remover
  const docsToRemove = await prisma.document.findMany({
    where: {
      category: 'acordao',
      isCommon: true,
      courseId: null,
      tcuArea: { in: AREAS_IRRELEVANTES },
    },
    select: { id: true, title: true, tcuArea: true },
  });

  console.log(`🎯 Total a remover: ${docsToRemove.length} acórdãos`);

  // Verificar se há algum com courseId nessas áreas (protegidos)
  const protectedCount = await prisma.document.count({
    where: {
      category: 'acordao',
      courseId: { not: null },
      tcuArea: { in: AREAS_IRRELEVANTES },
    },
  });
  if (protectedCount > 0) {
    console.log(`🛡️  ${protectedCount} acórdão(s) em áreas irrelevantes têm courseId e serão MANTIDOS`);
  }
  console.log('');

  if (docsToRemove.length === 0) {
    console.log('✅ Nenhum acórdão irrelevante encontrado. Nada a fazer.');
    return;
  }

  if (DRY_RUN) {
    // Mostrar amostra dos 10 primeiros
    console.log('📝 Amostra dos 10 primeiros a remover:');
    for (const doc of docsToRemove.slice(0, 10)) {
      console.log(`   [${doc.tcuArea}] ${doc.title}`);
    }
    if (docsToRemove.length > 10) {
      console.log(`   ... e mais ${docsToRemove.length - 10} acórdãos`);
    }

    // Contar chunks associados
    const docIds = docsToRemove.map(d => d.id);
    const chunksToRemove = await prisma.documentChunk.count({
      where: { documentId: { in: docIds } },
    });
    const favoritesToRemove = await prisma.favorite.count({
      where: { documentId: { in: docIds } },
    });

    console.log('');
    console.log('📊 Resumo do que seria removido:');
    console.log(`   Documentos: ${docsToRemove.length}`);
    console.log(`   Chunks (embeddings): ${chunksToRemove}`);
    console.log(`   Favoritos: ${favoritesToRemove}`);
    console.log(`   Acórdãos restantes: ${totalAcordaos - docsToRemove.length}`);
    console.log('');
    console.log('💡 Execute sem --dry-run para aplicar as mudanças.');
    return;
  }

  // 4. Executar remoção em transação
  console.log('🗑️  Removendo acórdãos irrelevantes...');

  const docIds = docsToRemove.map(d => d.id);

  const result = await prisma.$transaction(async (tx) => {
    // Deletar chunks (embeddings)
    const deletedChunks = await tx.documentChunk.deleteMany({
      where: { documentId: { in: docIds } },
    });
    console.log(`   ✓ ${deletedChunks.count} chunks removidos`);

    // Deletar favoritos
    const deletedFavorites = await tx.favorite.deleteMany({
      where: { documentId: { in: docIds } },
    });
    console.log(`   ✓ ${deletedFavorites.count} favoritos removidos`);

    // Deletar documentos
    const deletedDocs = await tx.document.deleteMany({
      where: { id: { in: docIds } },
    });
    console.log(`   ✓ ${deletedDocs.count} documentos removidos`);

    return {
      chunks: deletedChunks.count,
      favorites: deletedFavorites.count,
      documents: deletedDocs.count,
    };
  });

  // 5. Estatísticas finais
  const finalAcordaos = await prisma.document.count({
    where: { category: 'acordao' },
  });
  const finalChunks = await prisma.documentChunk.count({
    where: { document: { category: 'acordao' } },
  });

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      RESULTADO                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`   Removidos: ${result.documents} documentos, ${result.chunks} chunks, ${result.favorites} favoritos`);
  console.log(`   Acórdãos restantes: ${finalAcordaos} (antes: ${totalAcordaos})`);
  console.log(`   Chunks restantes: ${finalChunks} (antes: ${totalChunks})`);
  console.log('');
  console.log('✅ Limpeza concluída com sucesso!');
}

main()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
