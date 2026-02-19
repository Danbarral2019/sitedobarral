/**
 * Indexação de Atos Legislativos com Embeddings (LegislativeActChunk)
 *
 * Processa atos legislativos diretamente na tabela LegislativeActChunk
 * (sem criar Documents intermediários), gerando embeddings para busca semântica.
 *
 * Uso:
 *   npx tsx scripts/index-legislative-acts.ts
 *   npx tsx scripts/index-legislative-acts.ts --dry-run
 *   npx tsx scripts/index-legislative-acts.ts --force
 *   npx tsx scripts/index-legislative-acts.ts --limit 10
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

interface Options {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
}

async function indexLegislativeActs(options: Options = {}) {
  const { dryRun = false, force = false, limit } = options;

  console.log('🚀 Indexação de Atos Legislativos com Embeddings\n');
  console.log('Options:', { dryRun, force, limit: limit || 'all' });
  console.log('');

  try {
    // 1. Buscar atos pendentes
    const whereClause: Record<string, unknown> = {};

    if (!force) {
      whereClause.OR = [
        { embeddingStatus: null },
        { embeddingStatus: 'pending' },
        { embeddingStatus: 'failed' },
      ];
    }

    const acts = await prisma.legislativeAct.findMany({
      where: whereClause,
      select: {
        id: true,
        fullNumber: true,
        type: true,
        content: true,
        ementa: true,
        summary: true,
        embeddingStatus: true,
      },
      orderBy: { publishDate: 'asc' },
      ...(limit ? { take: limit } : {}),
    });

    // Filtrar atos que têm pelo menos ementa (todos devem ter)
    const indexable = acts.filter(a => a.ementa && a.ementa.length > 20);

    console.log(`📋 Total de atos encontrados: ${acts.length}`);
    console.log(`📋 Atos indexáveis (com ementa): ${indexable.length}`);

    // Status breakdown
    const statusCounts = acts.reduce((acc, act) => {
      const status = act.embeddingStatus || 'null';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('   Status:', statusCounts);

    // Content breakdown
    const withContent = indexable.filter(a => a.content && a.content.length > 50).length;
    const withSummary = indexable.filter(a => !a.content && a.summary && a.summary.length > 50).length;
    const ementaOnly = indexable.length - withContent - withSummary;
    console.log(`   Com content: ${withContent}, com summary: ${withSummary}, só ementa: ${ementaOnly}`);
    console.log('');

    if (indexable.length === 0) {
      console.log('✅ Nenhum ato para indexar.');
      return;
    }

    if (dryRun) {
      console.log('[DRY RUN] Atos que seriam indexados:');
      indexable.forEach(act => {
        const textLen = (act.content || act.summary || act.ementa || '').length;
        console.log(`   - ${act.fullNumber} (${act.type}) [${act.embeddingStatus || 'pending'}] ${textLen} chars`);
      });
      console.log('\n[DRY RUN] Nenhuma alteração feita.');
      return;
    }

    // 2. Processar cada ato
    const startTime = Date.now();
    let succeeded = 0;
    let failed = 0;
    let totalChunks = 0;

    for (let i = 0; i < indexable.length; i++) {
      const act = indexable[i];
      console.log(`\n[${i + 1}/${indexable.length}] Processando ${act.fullNumber}...`);

      const result = await processLegislativeAct(act.id, { forceReprocess: force });

      if (result.success) {
        succeeded++;
        totalChunks += result.stats?.chunkCount || 0;
      } else {
        failed++;
        console.log(`   ❌ Falha: ${result.error}`);
      }

      // Rate limiting: pausa entre cada ato
      if (i < indexable.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 3. Sumário
    const totalTime = (Date.now() - startTime) / 1000;

    console.log('\n' + '='.repeat(50));
    console.log('📊 Sumário da Indexação');
    console.log('='.repeat(50));
    console.log(`Total processado: ${indexable.length}`);
    console.log(`Sucesso: ${succeeded}`);
    console.log(`Falha: ${failed}`);
    console.log(`Total de chunks: ${totalChunks}`);
    console.log(`Tempo total: ${totalTime.toFixed(1)}s`);

    if (failed > 0) {
      console.log('\n⚠️  Alguns atos falharam. Execute novamente para retentar.');
    } else {
      console.log('\n✅ Indexação concluída com sucesso!');
    }

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse args
function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--force') options.force = true;
    else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Indexação de Atos Legislativos com Embeddings

Uso:
  npx tsx scripts/index-legislative-acts.ts [opções]

Opções:
  --dry-run   Simula sem alterar o banco
  --force     Reprocessa todos (incluindo completed)
  --limit N   Processa apenas os primeiros N atos
  --help      Mostra esta mensagem
      `);
      process.exit(0);
    }
  }

  return options;
}

indexLegislativeActs(parseArgs())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
