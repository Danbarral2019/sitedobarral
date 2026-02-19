/**
 * Tribunal Decision Processor para Busca Semantica
 *
 * Pipeline: TribunalDecision -> Texto -> Chunks -> Embeddings -> pgvector
 * Espelha legislative-act-processor.ts para decisoes de tribunais
 */

import { prisma } from '@/lib/prisma';
import { chunkLegalDocument, type TextChunk } from './text-chunker';
import { generateBatchEmbeddings, embeddingToSql } from './gemini-embeddings';

// ===========================
// Types
// ===========================

export interface DecisionProcessingResult {
  success: boolean;
  decisionId: string;
  error?: string;
  stats?: {
    textLength: number;
    chunkCount: number;
    processingTime: number;
  };
}

// ===========================
// Main Processing Function
// ===========================

/**
 * Processa uma decisao de tribunal: monta texto, cria chunks, gera embeddings
 */
export async function processTribunalDecision(
  decisionId: string,
  options: { forceReprocess?: boolean } = {}
): Promise<DecisionProcessingResult> {
  const startTime = Date.now();

  try {
    // 1. Buscar decisao
    const decision = await prisma.tribunalDecision.findUnique({
      where: { id: decisionId },
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
    });

    if (!decision) {
      return { success: false, decisionId, error: 'Tribunal decision not found' };
    }

    // 2. Atomic claim
    if (!options.forceReprocess) {
      const claimed = await prisma.tribunalDecision.updateMany({
        where: {
          id: decisionId,
          OR: [
            { embeddingStatus: null },
            { embeddingStatus: { notIn: ['processing', 'completed'] } },
          ],
        },
        data: { embeddingStatus: 'processing' },
      });

      if (claimed.count === 0) {
        return {
          success: true,
          decisionId,
          stats: { textLength: 0, chunkCount: 0, processingTime: Date.now() - startTime },
        };
      }
    } else {
      await prisma.tribunalDecision.update({
        where: { id: decisionId },
        data: { embeddingStatus: 'processing' },
      });
    }

    // 3. Montar texto: fullIdentifier + ementa + fullText
    const textParts = [decision.fullIdentifier, decision.ementa];
    if (decision.fullText) textParts.push(decision.fullText);
    else if (decision.summary) textParts.push(decision.summary);

    const fullText = textParts.join('\n\n');

    if (fullText.length < 50) {
      await prisma.tribunalDecision.update({
        where: { id: decisionId },
        data: { embeddingStatus: 'failed' },
      });
      return { success: false, decisionId, error: 'Text too short for embedding' };
    }

    // 4. Chunk
    console.log(`Chunking "${decision.fullIdentifier}" (${fullText.length} chars)...`);
    const rawChunks = chunkLegalDocument(fullText, {
      maxChunkSize: 2400,
      overlapSize: 400,
    });

    // 4b. Prefixar metadados
    const metaPrefix = `[${decision.tribunalCode} ${decision.decisionType} ${decision.decisionNumber}]\n`;
    const chunks = rawChunks.map(chunk => ({
      ...chunk,
      content: metaPrefix + chunk.content,
    }));

    if (chunks.length === 0) {
      await prisma.tribunalDecision.update({
        where: { id: decisionId },
        data: { embeddingStatus: 'failed' },
      });
      return { success: false, decisionId, error: 'No chunks generated' };
    }

    // 5. Gerar embeddings
    console.log(`Generating ${chunks.length} embeddings for "${decision.fullIdentifier}"...`);
    const embeddingResult = await generateBatchEmbeddings(chunks.map(c => c.content));

    // 6. Delete chunks antigos
    await prisma.$executeRaw`DELETE FROM "TribunalDecisionChunk" WHERE "tribunalDecisionId" = ${decisionId}`;

    // 7. Insert novos chunks
    await saveDecisionChunksToDatabase(decisionId, chunks, embeddingResult.embeddings);

    // 8. Atualizar status
    await prisma.tribunalDecision.update({
      where: { id: decisionId },
      data: {
        embeddingStatus: 'completed',
        chunkCount: chunks.length,
        embeddedAt: new Date(),
      },
    });

    const processingTime = Date.now() - startTime;
    console.log(`"${decision.fullIdentifier}" processed: ${chunks.length} chunks in ${processingTime}ms`);

    return {
      success: true,
      decisionId,
      stats: {
        textLength: fullText.length,
        chunkCount: chunks.length,
        processingTime,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing decision ${decisionId}:`, error);

    try {
      await prisma.tribunalDecision.update({
        where: { id: decisionId },
        data: { embeddingStatus: 'failed' },
      });
    } catch { /* ignore */ }

    return { success: false, decisionId, error: errorMessage };
  }
}

// ===========================
// Helper Functions
// ===========================

/**
 * Salva chunks com embeddings no banco usando raw SQL (pgvector)
 * Insere em batches de 50 para performance
 */
async function saveDecisionChunksToDatabase(
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
