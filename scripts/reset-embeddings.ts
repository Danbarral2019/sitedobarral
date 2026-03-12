/**
 * Reset Embeddings Script
 *
 * Reseta o embeddingStatus de todas as tabelas com embeddings para 'pending'
 * e remove chunks antigos para reprocessamento com novo modelo.
 *
 * Necessario apos trocar de modelo (ex: gemini-embedding-001 → gemini-embedding-2-preview)
 * porque vetores de modelos diferentes sao incompativeis.
 *
 * Tabelas afetadas:
 *   - Document → DocumentChunk
 *   - LegislativeAct → LegislativeActChunk
 *   - TribunalDecision → TribunalDecisionChunk
 *   - LeiArticle → LeiArticleEmbedding
 *
 * Uso:
 *   npx tsx scripts/reset-embeddings.ts
 *   npx tsx scripts/reset-embeddings.ts --dry-run   # Simular execucao
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

async function resetEmbeddings() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🔄 Reset Embeddings para novo modelo (todas as tabelas)\n');

  // 1. Conta registros com embeddings
  const [docCompleted, actCompleted, decisionCompleted, leiEmbeddings] = await Promise.all([
    prisma.document.count({ where: { embeddingStatus: 'completed' } }),
    prisma.legislativeAct.count({ where: { embeddingStatus: 'completed' } }),
    prisma.tribunalDecision.count({ where: { embeddingStatus: 'completed' } }),
    prisma.$executeRaw`SELECT count(*) FROM "LeiArticleEmbedding"`.catch(() => 0),
  ]);

  const [docChunks, actChunks, decChunks] = await Promise.all([
    prisma.documentChunk.count(),
    prisma.legislativeActChunk.count(),
    prisma.tribunalDecisionChunk.count(),
  ]);

  // Count LeiArticleEmbedding separately (may not have Prisma model)
  let leiCount = 0;
  try {
    const result = await prisma.$queryRaw<[{ count: bigint }]>`SELECT count(*) as count FROM "LeiArticleEmbedding"`;
    leiCount = Number(result[0].count);
  } catch {
    // Table may not exist
  }

  console.log(`📊 Estado atual:`);
  console.log(`   Document: ${docCompleted} completed, ${docChunks} chunks`);
  console.log(`   LegislativeAct: ${actCompleted} completed, ${actChunks} chunks`);
  console.log(`   TribunalDecision: ${decisionCompleted} completed, ${decChunks} chunks`);
  console.log(`   LeiArticleEmbedding: ${leiCount} embeddings`);

  const totalChunks = docChunks + actChunks + decChunks + leiCount;
  const totalCompleted = docCompleted + actCompleted + decisionCompleted;

  if (totalChunks === 0 && totalCompleted === 0) {
    console.log('\n✅ Nenhum embedding para resetar.');
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Removeria ${totalChunks} chunks/embeddings`);
    console.log(`[DRY RUN] Resetaria ${totalCompleted} registros para 'pending'`);
    console.log('\nRode sem --dry-run para executar.');
    await prisma.$disconnect();
    return;
  }

  // 2. Remove chunks antigos (incompativeis com novo modelo)
  console.log('\n🗑️  Removendo chunks antigos...');

  const [deletedDoc, deletedAct, deletedDec] = await Promise.all([
    prisma.$executeRaw`DELETE FROM "DocumentChunk"`,
    prisma.$executeRaw`DELETE FROM "LegislativeActChunk"`,
    prisma.$executeRaw`DELETE FROM "TribunalDecisionChunk"`,
  ]);

  let deletedLei = 0;
  try {
    deletedLei = await prisma.$executeRaw`DELETE FROM "LeiArticleEmbedding"`;
  } catch {
    console.log('   LeiArticleEmbedding: tabela nao existe (pulando)');
  }

  console.log(`   DocumentChunk: ${deletedDoc} removidos`);
  console.log(`   LegislativeActChunk: ${deletedAct} removidos`);
  console.log(`   TribunalDecisionChunk: ${deletedDec} removidos`);
  console.log(`   LeiArticleEmbedding: ${deletedLei} removidos`);

  // 3. Reseta status de todos os registros
  console.log('\n🔄 Resetando embeddingStatus para pending...');

  const statusFilter = { in: ['completed', 'failed', 'processing'] };

  const [updatedDocs, updatedActs, updatedDecs] = await Promise.all([
    prisma.document.updateMany({
      where: { embeddingStatus: statusFilter },
      data: {
        embeddingStatus: 'pending',
        embeddingError: null,
        chunkCount: 0,
        embeddedAt: null,
      },
    }),
    prisma.legislativeAct.updateMany({
      where: { embeddingStatus: statusFilter },
      data: { embeddingStatus: 'pending' },
    }),
    prisma.tribunalDecision.updateMany({
      where: { embeddingStatus: statusFilter },
      data: { embeddingStatus: 'pending' },
    }),
  ]);

  console.log(`   Document: ${updatedDocs.count} resetados`);
  console.log(`   LegislativeAct: ${updatedActs.count} resetados`);
  console.log(`   TribunalDecision: ${updatedDecs.count} resetados`);

  console.log('\n✅ Reset completo!');
  console.log('   Proximos passos:');
  console.log('   1. npx tsx scripts/migrate-to-embeddings.ts --force');
  console.log('   2. npx tsx scripts/index-legislative-acts.ts --force');
  console.log('   3. Tribunal decisions serao reprocessadas pelo cron');

  await prisma.$disconnect();
}

resetEmbeddings()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
