/**
 * backfill-pending-embeddings.ts
 *
 * Roda processDocument nos Documents com embeddingStatus pending/null/failed.
 * Necessário porque o cron `/api/cron/process-index-jobs` filtra por
 * `r2Key: { not: null }` — virtualmente nenhum doc tem r2Key, então o cron
 * não pega ninguém. processDocument já tem fallback pra link-type
 * (linhas 151-178 de document-processor.ts: usa content || description).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-pending-embeddings.ts                # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-pending-embeddings.ts --apply        # processa todos
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-pending-embeddings.ts --apply --limit=10
 */

import { prisma } from '../lib/prisma';
import { processDocuments } from '../lib/embeddings/document-processor';

async function main() {
  const apply = process.argv.includes('--apply');
  const includeFailed = !process.argv.includes('--no-retry-failed');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('='.repeat(60));
  console.log(`BACKFILL PENDING EMBEDDINGS — ${apply ? 'APPLY' : 'DRY-RUN'}${limit ? ` (limit=${limit})` : ''}`);
  console.log('='.repeat(60) + '\n');

  // Query: pending + null + (opcional) failed.
  // Excluir o doc com erro de R2 (não tem como recuperar sem o arquivo).
  const statuses = includeFailed
    ? ['pending', null, 'failed']
    : ['pending', null];

  const all = await prisma.document.findMany({
    where: {
      OR: statuses.map((s) => (s === null ? { embeddingStatus: null } : { embeddingStatus: s })),
    },
    select: {
      id: true,
      title: true,
      category: true,
      embeddingStatus: true,
      embeddingError: true,
      content: true,
      description: true,
      r2Key: true,
    },
    orderBy: { uploadedAt: 'asc' }, // FIFO
  });

  // Excluir docs com erro R2 (sem arquivo = não dá pra processar) — feito em JS
  // pra evitar quirk do Prisma NOT-contains com nulls.
  const candidates = all
    .filter((d) => !(d.embeddingError && d.embeddingError.includes('Failed to download from R2')))
    .slice(0, limit);

  console.log(`Candidatos: ${candidates.length}`);
  const byStatus = new Map<string, number>();
  const byCat = new Map<string, number>();
  for (const c of candidates) {
    const s = c.embeddingStatus ?? 'NULL';
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
    byCat.set(c.category, (byCat.get(c.category) ?? 0) + 1);
  }
  console.log('\nPor status:');
  for (const [s, n] of byStatus) console.log(`  ${s.padEnd(12)} ${n}`);
  console.log('\nPor categoria:');
  for (const [c, n] of byCat) console.log(`  ${c.padEnd(28)} ${n}`);

  // Atos sem texto suficiente: vamos pular (processDocument vai falhar e marcar 'failed')
  const tooShort = candidates.filter((c) => {
    if (c.r2Key) return false; // tem arquivo, processDocument lida
    const len = (c.content?.length ?? 0) + (c.description?.length ?? 0);
    return len < 50;
  });
  if (tooShort.length > 0) {
    console.log(`\n⚠️  ${tooShort.length} sem texto suficiente (vão falhar):`);
    for (const t of tooShort.slice(0, 5)) console.log(`  - ${t.category} | ${t.title.slice(0, 60)}`);
  }

  if (!apply) {
    console.log('\nPara aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/backfill-pending-embeddings.ts --apply');
    await prisma.$disconnect();
    return;
  }

  if (candidates.length === 0) {
    console.log('\nNada a fazer.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n🚀 Processando ${candidates.length} docs com concorrência 3...\n`);
  const startTime = Date.now();
  const results = await processDocuments(
    candidates.map((c) => c.id),
    { forceReprocess: includeFailed }, // se incluir failed, força reprocess
    3, // concorrência baixa pra respeitar quota Gemini
  );

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  const ok = results.filter((r) => r.success).length;
  const ko = results.filter((r) => !r.success).length;
  const totalChunks = results.reduce((s, r) => s + (r.stats?.chunkCount ?? 0), 0);

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Sucessos: ${ok} | ❌ Falhas: ${ko} | Chunks criados: ${totalChunks} | Tempo: ${durationSec}s`);

  if (ko > 0) {
    console.log('\nFalhas:');
    for (const r of results.filter((r) => !r.success)) {
      const doc = candidates.find((c) => c.id === r.documentId);
      console.log(`  ❌ ${doc?.category ?? '?'}/${doc?.title?.slice(0, 50) ?? r.documentId}: ${r.error}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
