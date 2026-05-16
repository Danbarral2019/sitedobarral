/**
 * Legislative Act Processor para Busca Semantica
 *
 * Pipeline: LegislativeAct → Texto → Chunks → Embeddings → pgvector
 * Espelha document-processor.ts para atos legislativos
 */

import { prisma } from '@/lib/prisma';
import { chunkLegalDocument, type TextChunk } from './text-chunker';
import { generateBatchEmbeddings, embeddingToSql } from './gemini-embeddings';
import { apiLogger } from "@/lib/logger";

// ===========================
// Types
// ===========================

export interface ActProcessingResult {
  success: boolean;
  actId: string;
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
 * Processa um ato legislativo: monta texto, cria chunks, gera embeddings
 */
export async function processLegislativeAct(
  actId: string,
  options: { forceReprocess?: boolean } = {}
): Promise<ActProcessingResult> {
  const startTime = Date.now();

  try {
    // 1. Busca ato no banco
    const act = await prisma.legislativeAct.findUnique({
      where: { id: actId },
      select: {
        id: true,
        fullNumber: true,
        ementa: true,
        content: true,
        summary: true,
        type: true,
        embeddingStatus: true,
      },
    });

    if (!act) {
      return { success: false, actId, error: 'Legislative act not found' };
    }

    // 2. Atomically claim processing slot
    if (!options.forceReprocess) {
      const claimed = await prisma.legislativeAct.updateMany({
        where: {
          id: actId,
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
          actId,
          stats: { textLength: 0, chunkCount: 0, processingTime: Date.now() - startTime },
        };
      }
    } else {
      await prisma.legislativeAct.update({
        where: { id: actId },
        data: { embeddingStatus: 'processing' },
      });
    }

    // 3. Montar texto: fullNumber + ementa + content
    const textParts = [act.fullNumber, act.ementa];
    if (act.content) textParts.push(act.content);
    else if (act.summary) textParts.push(act.summary);

    const fullText = textParts.join('\n\n');

    if (fullText.length < 50) {
      await prisma.legislativeAct.update({
        where: { id: actId },
        data: { embeddingStatus: 'failed' },
      });
      return { success: false, actId, error: 'Text too short for embedding' };
    }

    // 4. Chunkar com chunkLegalDocument
    console.log(`✂️ Chunking "${act.fullNumber}" (${fullText.length} chars)...`);
    const rawChunks = chunkLegalDocument(fullText, {
      maxChunkSize: 2400,
      overlapSize: 400,
    });

    // 4b. Prefixar metadados nos chunks para enriquecer embeddings
    const metaPrefix = `[${act.fullNumber} | ${act.type}]\n`;
    const chunks = rawChunks.map(chunk => ({
      ...chunk,
      content: metaPrefix + chunk.content,
    }));

    if (chunks.length === 0) {
      await prisma.legislativeAct.update({
        where: { id: actId },
        data: { embeddingStatus: 'failed' },
      });
      return { success: false, actId, error: 'No chunks generated' };
    }

    // 5. Gerar embeddings em batch
    console.log(`🧠 Generating ${chunks.length} embeddings for "${act.fullNumber}"...`);
    const embeddingResult = await generateBatchEmbeddings(chunks.map(c => c.content));

    // 6. Deletar chunks antigos
    await prisma.$executeRaw`DELETE FROM "LegislativeActChunk" WHERE "legislativeActId" = ${actId}`;

    // 7. Inserir novos chunks via SQL raw com pgvector
    await saveActChunksToDatabase(actId, chunks, embeddingResult.embeddings);

    // 8. Atualizar status
    await prisma.legislativeAct.update({
      where: { id: actId },
      data: {
        embeddingStatus: 'completed',
        chunkCount: chunks.length,
        embeddedAt: new Date(),
      },
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ "${act.fullNumber}" processed: ${chunks.length} chunks in ${processingTime}ms`);

    return {
      success: true,
      actId,
      stats: {
        textLength: fullText.length,
        chunkCount: chunks.length,
        processingTime,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    apiLogger.error({ err: error }, `❌ Error processing act ${actId}:`);

    try {
      await prisma.legislativeAct.update({
        where: { id: actId },
        data: { embeddingStatus: 'failed' },
      });
    } catch { /* ignore */ }

    return { success: false, actId, error: errorMessage };
  }
}

// ===========================
// Helper Functions
// ===========================

/**
 * Salva chunks com embeddings no banco usando raw SQL (pgvector)
 * Insere em batches de 50 para performance
 */
async function saveActChunksToDatabase(
  actId: string,
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
      return `(gen_random_uuid(), '${actId.replace(/'/g, "''")}', ${chunk.index}, '${escapedContent}', ${chunk.charStart}, ${chunk.charEnd}, '${embStr}'::vector, NOW(), NOW())`;
    });

    await prisma.$executeRawUnsafe(`
      INSERT INTO "LegislativeActChunk" (id, "legislativeActId", "chunkIndex", content, "charStart", "charEnd", embedding, "createdAt", "updatedAt")
      VALUES ${values.join(',\n')}
    `);
  }
}
