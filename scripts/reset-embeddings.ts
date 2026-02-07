/**
 * Reset Embeddings Script
 *
 * Reseta o embeddingStatus de todos os documentos para 'pending'
 * para que sejam reprocessados com o novo modelo de embedding.
 *
 * Necessario apos trocar de modelo (ex: text-embedding-004 → gemini-embedding-001)
 * porque vetores de modelos diferentes sao incompativeis.
 *
 * Uso:
 *   npx tsx scripts/reset-embeddings.ts
 *   npx tsx scripts/reset-embeddings.ts --dry-run   # Simular execucao
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

async function resetEmbeddings() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🔄 Reset Embeddings para novo modelo\n');

  // 1. Conta documentos com embeddings
  const completedCount = await prisma.document.count({
    where: { embeddingStatus: 'completed' },
  });

  const totalWithR2 = await prisma.document.count({
    where: { r2Key: { not: null } },
  });

  console.log(`📊 Documentos com r2Key: ${totalWithR2}`);
  console.log(`📊 Documentos com embeddings completos: ${completedCount}`);

  if (completedCount === 0) {
    console.log('\n✅ Nenhum documento com embeddings para resetar.');
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Resetaria ${completedCount} documentos para 'pending'`);
    console.log('[DRY RUN] Removeria todos os chunks existentes');
    console.log('\nRode sem --dry-run para executar.');
    await prisma.$disconnect();
    return;
  }

  // 2. Remove chunks antigos (incompativeis com novo modelo)
  console.log('\n🗑️  Removendo chunks antigos...');
  const deletedChunks = await prisma.$executeRaw`DELETE FROM "DocumentChunk"`;
  console.log(`   Removidos ${deletedChunks} chunks`);

  // 3. Reseta status de todos os documentos
  console.log('🔄 Resetando embeddingStatus para pending...');
  const updated = await prisma.document.updateMany({
    where: {
      embeddingStatus: { in: ['completed', 'failed', 'processing'] },
    },
    data: {
      embeddingStatus: 'pending',
      embeddingError: null,
      chunkCount: 0,
      embeddedAt: null,
    },
  });

  console.log(`   Resetados ${updated.count} documentos`);

  console.log('\n✅ Reset completo!');
  console.log('   Proximo passo: os documentos serao reprocessados automaticamente pelo cron');
  console.log('   Ou rode: npx tsx scripts/migrate-to-embeddings.ts');

  await prisma.$disconnect();
}

resetEmbeddings()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
