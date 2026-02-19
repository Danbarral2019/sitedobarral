/**
 * Indexacao de Decisoes de Tribunal com Embeddings (TribunalDecisionChunk)
 *
 * Processa decisoes de tribunal aprovadas, gerando embeddings para busca semantica.
 * Usa PrismaNeon adapter (obrigatorio para Prisma 7 em scripts standalone).
 *
 * Uso:
 *   npx tsx scripts/index-tribunal-decisions.ts
 *   npx tsx scripts/index-tribunal-decisions.ts --dry-run
 *   npx tsx scripts/index-tribunal-decisions.ts --force
 *   npx tsx scripts/index-tribunal-decisions.ts --limit 10
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { chunkLegalDocument, type TextChunk } from '../lib/embeddings/text-chunker';
import { generateBatchEmbeddings, embeddingToSql } from '../lib/embeddings/gemini-embeddings';

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

interface Options {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
}

async function indexTribunalDecisions(options: Options = {}) {
  const { dryRun = false, force = false, limit } = options;

  console.log('Indexacao de Decisoes de Tribunal com Embeddings\n');
  console.log('Options:', { dryRun, force, limit: limit || 'all' });
  console.log('');

  try {
    // 1. Buscar decisoes aprovadas pendentes de embedding
    const whereClause: Record<string, unknown> = {
      approvalStatus: { in: ['auto_approved', 'manually_approved'] },
    };

    if (!force) {
      whereClause.OR = [
        { embeddingStatus: null },
        { embeddingStatus: 'pending' },
        { embeddingStatus: 'failed' },
      ];
    }

    const decisions = await prisma.tribunalDecision.findMany({
      where: whereClause,
      select: {
        id: true,
        fullIdentifier: true,
        tribunalCode: true,
        decisionType: true,
        decisionNumber: true,
        ementa: true,
        fullText: true,
        summary: true,
        embeddingStatus: true,
      },
      orderBy: { dataJulgamento: 'desc' },
      ...(limit ? { take: limit } : {}),
    });

    // Filtrar decisoes com pelo menos ementa
    const indexable = decisions.filter(d => d.ementa && d.ementa.length > 20);

    console.log(`Total de decisoes encontradas: ${decisions.length}`);
    console.log(`Decisoes indexaveis (com ementa): ${indexable.length}`);

    // Status breakdown
    const statusCounts = decisions.reduce((acc, d) => {
      const status = d.embeddingStatus || 'null';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('   Status:', statusCounts);

    // Content breakdown
    const withFullText = indexable.filter(d => d.fullText && d.fullText.length > 50).length;
    const withSummary = indexable.filter(d => !d.fullText && d.summary && d.summary.length > 50).length;
    const ementaOnly = indexable.length - withFullText - withSummary;
    console.log(`   Com fullText: ${withFullText}, com summary: ${withSummary}, so ementa: ${ementaOnly}`);
    console.log('');

    if (indexable.length === 0) {
      console.log('Nenhuma decisao para indexar.');
      return;
    }

    if (dryRun) {
      console.log('[DRY RUN] Decisoes que seriam indexadas:');
      indexable.forEach(d => {
        const textLen = (d.fullText || d.summary || d.ementa || '').length;
        console.log(`   - ${d.fullIdentifier} [${d.embeddingStatus || 'pending'}] ${textLen} chars`);
      });
      console.log('\n[DRY RUN] Nenhuma alteracao feita.');
      return;
    }

    // 2. Processar cada decisao
    const startTime = Date.now();
    let succeeded = 0;
    let failed = 0;
    let totalChunks = 0;

    for (let i = 0; i < indexable.length; i++) {
      const decision = indexable[i];
      console.log(`\n[${i + 1}/${indexable.length}] Processando ${decision.fullIdentifier}...`);

      try {
        // Mark as processing
        await prisma.tribunalDecision.update({
          where: { id: decision.id },
          data: { embeddingStatus: 'processing' },
        });

        // Build text
        const textParts = [decision.fullIdentifier, decision.ementa];
        if (decision.fullText) textParts.push(decision.fullText);
        else if (decision.summary) textParts.push(decision.summary);

        const fullText = textParts.join('\n\n');

        if (fullText.length < 50) {
          console.log(`   Texto muito curto (${fullText.length} chars), pulando`);
          await prisma.tribunalDecision.update({
            where: { id: decision.id },
            data: { embeddingStatus: 'failed' },
          });
          failed++;
          continue;
        }

        // Chunk
        const rawChunks = chunkLegalDocument(fullText, {
          maxChunkSize: 2400,
          overlapSize: 400,
        });

        const metaPrefix = `[${decision.tribunalCode} ${decision.decisionType} ${decision.decisionNumber}]\n`;
        const chunks = rawChunks.map(chunk => ({
          ...chunk,
          content: metaPrefix + chunk.content,
        }));

        if (chunks.length === 0) {
          console.log('   Nenhum chunk gerado, pulando');
          await prisma.tribunalDecision.update({
            where: { id: decision.id },
            data: { embeddingStatus: 'failed' },
          });
          failed++;
          continue;
        }

        // Generate embeddings
        console.log(`   Gerando ${chunks.length} embeddings...`);
        const embeddingResult = await generateBatchEmbeddings(chunks.map(c => c.content));

        // Delete old chunks
        await prisma.$executeRaw`DELETE FROM "TribunalDecisionChunk" WHERE "tribunalDecisionId" = ${decision.id}`;

        // Insert new chunks
        await saveDecisionChunks(decision.id, chunks, embeddingResult.embeddings);

        // Update status
        await prisma.tribunalDecision.update({
          where: { id: decision.id },
          data: {
            embeddingStatus: 'completed',
            chunkCount: chunks.length,
            embeddedAt: new Date(),
          },
        });

        succeeded++;
        totalChunks += chunks.length;
        console.log(`   ${chunks.length} chunks criados`);
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   Falha: ${msg}`);

        try {
          await prisma.tribunalDecision.update({
            where: { id: decision.id },
            data: { embeddingStatus: 'failed' },
          });
        } catch { /* ignore */ }
      }

      // Rate limiting
      if (i < indexable.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 3. Sumario
    const totalTime = (Date.now() - startTime) / 1000;

    console.log('\n' + '='.repeat(50));
    console.log('Sumario da Indexacao');
    console.log('='.repeat(50));
    console.log(`Total processado: ${indexable.length}`);
    console.log(`Sucesso: ${succeeded}`);
    console.log(`Falha: ${failed}`);
    console.log(`Total de chunks: ${totalChunks}`);
    console.log(`Tempo total: ${totalTime.toFixed(1)}s`);

    if (failed > 0) {
      console.log('\nAlgumas decisoes falharam. Execute novamente para retentar.');
    } else {
      console.log('\nIndexacao concluida com sucesso!');
    }
  } catch (error) {
    console.error('Erro fatal:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function saveDecisionChunks(
  decisionId: string,
  chunks: TextChunk[],
  embeddings: number[][]
): Promise<void> {
  if (chunks.length === 0) return;

  const BATCH_SIZE = 50;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    const values = batch.map((chunk, j) => {
      const embStr = embeddingToSql(batchEmbeddings[j]);
      const escapedContent = chunk.content.replace(/'/g, "''");
      return `(gen_random_uuid(), '${decisionId.replace(/'/g, "''")}', ${chunk.index}, '${escapedContent}', ${chunk.charStart}, ${chunk.charEnd}, '${embStr}'::vector, NOW(), NOW())`;
    });

    await prisma.$executeRawUnsafe(`
      INSERT INTO "TribunalDecisionChunk" (id, "tribunalDecisionId", "chunkIndex", content, "charStart", "charEnd", embedding, "createdAt", "updatedAt")
      VALUES ${values.join(',\n')}
    `);
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
Indexacao de Decisoes de Tribunal com Embeddings

Uso:
  npx tsx scripts/index-tribunal-decisions.ts [opcoes]

Opcoes:
  --dry-run   Simula sem alterar o banco
  --force     Reprocessa todos (incluindo completed)
  --limit N   Processa apenas as primeiras N decisoes
  --help      Mostra esta mensagem
      `);
      process.exit(0);
    }
  }

  return options;
}

indexTribunalDecisions(parseArgs())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
