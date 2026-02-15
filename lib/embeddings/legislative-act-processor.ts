/**
 * Legislative Act Processor para Busca Semantica
 *
 * Pipeline: LegislativeAct → Texto → Chunks → Embeddings → pgvector
 * Espelha document-processor.ts para atos legislativos
 */

import { prisma } from '@/lib/prisma';
import { chunkLegalDocument, type TextChunk } from './text-chunker';
import { generateBatchEmbeddings, embeddingToSql } from './gemini-embeddings';

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
    const chunks = chunkLegalDocument(fullText, {
      maxChunkSize: 1200,
      overlapSize: 200,
    });

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
    console.error(`❌ Error processing act ${actId}:`, error);

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
 */
async function saveActChunksToDatabase(
  actId: string,
  chunks: TextChunk[],
  embeddings: number[][]
): Promise<void> {
  const { Prisma } = await import('@prisma/client');

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const embeddingStr = embeddingToSql(embedding);

    await prisma.$executeRaw`
      INSERT INTO "LegislativeActChunk" (
        id, "legislativeActId", "chunkIndex", content, "charStart", "charEnd", embedding, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        ${actId},
        ${chunk.index},
        ${chunk.content},
        ${chunk.charStart},
        ${chunk.charEnd},
        ${Prisma.raw(`'${embeddingStr}'::vector`)},
        NOW(),
        NOW()
      )
    `;
  }
}
