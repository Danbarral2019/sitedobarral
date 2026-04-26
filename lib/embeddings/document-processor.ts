/**
 * Document Processor para Busca Semantica
 *
 * Pipeline completo: R2 → Extracao → Chunks → Embeddings → pgvector
 */

import { prisma } from '@/lib/prisma';
import { downloadFromR2 } from '@/lib/storage/r2-client';
import { extractText, normalizeText } from '@/lib/text-extractor';
import { chunkText, chunkLegalDocument, chunkTCUDocument, TextChunk } from './text-chunker';
import { generateBatchEmbeddings, embeddingToSql } from './gemini-embeddings';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';

// ===========================
// Types
// ===========================

export interface ProcessingResult {
  success: boolean;
  documentId: string;
  error?: string;
  stats?: {
    textLength: number;
    chunkCount: number;
    processingTime: number;
  };
}

export interface ProcessingOptions {
  forceReprocess?: boolean;  // Reprocessar mesmo se ja tiver embeddings
  chunkSize?: number;        // Tamanho maximo do chunk
  overlapSize?: number;      // Tamanho do overlap
}

// ===========================
// Main Processing Function
// ===========================

/**
 * Processa um documento: extrai texto, cria chunks, gera embeddings
 *
 * @param documentId - ID do documento no banco
 * @param options - Opcoes de processamento
 * @returns Resultado do processamento
 */
export async function processDocument(
  documentId: string,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // 1. Busca documento no banco
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        r2Key: true,
        type: true,
        category: true,
        embeddingStatus: true,
        extractedText: true,
        content: true,
        description: true,
        leiArticles: true,
      },
    });

    if (!document) {
      return {
        success: false,
        documentId,
        error: 'Document not found',
      };
    }

    // 2. Atomically claim processing slot (prevents race condition)
    if (!options.forceReprocess) {
      const claimed = await prisma.document.updateMany({
        where: {
          id: documentId,
          embeddingStatus: { notIn: ['processing', 'completed'] },
        },
        data: {
          embeddingStatus: 'processing',
          embeddingError: null,
        },
      });

      if (claimed.count === 0) {
        console.log(`⏭️ Document ${documentId} already processed or in progress, skipping`);
        return {
          success: true,
          documentId,
          stats: {
            textLength: document.extractedText?.length || 0,
            chunkCount: 0,
            processingTime: Date.now() - startTime,
          },
        };
      }
    } else {
      // Force reprocess: just mark as processing
      await updateDocumentStatus(documentId, 'processing');
    }

    let extractedText = document.extractedText;

    if (document.r2Key) {
      // 4a. Download do arquivo do R2
      console.log(`📥 Downloading ${document.title} from R2...`);
      let fileBuffer: Buffer;
      try {
        fileBuffer = await downloadFromR2(document.r2Key);
      } catch {
        await updateDocumentStatus(documentId, 'failed', 'Failed to download from R2');
        return {
          success: false,
          documentId,
          error: 'Failed to download from R2',
        };
      }

      // 5a. Extrai texto do documento
      console.log(`📄 Extracting text from ${document.type}...`);
      const mimeType = getMimeType(document.type);

      if (!extractedText || options.forceReprocess) {
        const extraction = await extractTextWithFallback(fileBuffer, mimeType);

        if (!extraction.success) {
          await updateDocumentStatus(documentId, 'failed', extraction.error);
          return {
            success: false,
            documentId,
            error: extraction.error,
          };
        }

        extractedText = normalizeText(extraction.text);

        await prisma.document.update({
          where: { id: documentId },
          data: {
            extractedText,
            textExtractedAt: new Date(),
          },
        });
      }
    } else {
      // 4b. Sem R2 — usar texto já disponível (content, description, etc.)
      if (!extractedText || options.forceReprocess) {
        const fallbackText = document.content || document.description || '';
        if (fallbackText.length < 50) {
          await updateDocumentStatus(documentId, 'failed', 'No R2 key and no text content available');
          return {
            success: false,
            documentId,
            error: 'No R2 key and no text content available',
          };
        }

        // Prefixar com título para contexto
        const titlePrefix = document.title ? `${document.title}\n\n` : '';
        extractedText = normalizeText(titlePrefix + fallbackText);

        await prisma.document.update({
          where: { id: documentId },
          data: {
            extractedText,
            textExtractedAt: new Date(),
          },
        });

        console.log(`📝 Using existing text content (${extractedText.length} chars) for ${document.title}`);
      }
    }

    // 7. Cria chunks do texto
    console.log(`✂️ Chunking text (${extractedText.length} chars)...`);
    const rawChunks = createChunksForDocument(extractedText, document.category, options);

    // 7b. Prefixar metadados nos chunks para enriquecer embeddings
    let leiArticlesStr = '';
    if (document.leiArticles) {
      try {
        const arts = JSON.parse(document.leiArticles);
        if (Array.isArray(arts) && arts.length > 0) {
          leiArticlesStr = arts.join(', ');
        }
      } catch { /* ignore */ }
    }
    const metaPrefix = `[${document.title} | ${document.category}${leiArticlesStr ? ` | Arts. ${leiArticlesStr}` : ''}]\n`;
    const chunks = rawChunks.map(chunk => ({
      ...chunk,
      content: metaPrefix + chunk.content,
    }));

    if (chunks.length === 0) {
      await updateDocumentStatus(documentId, 'failed', 'No chunks generated (text too short?)');
      return {
        success: false,
        documentId,
        error: 'No chunks generated',
      };
    }

    console.log(`📦 Created ${chunks.length} chunks`);

    // 8. Remove chunks antigos
    await prisma.$executeRaw`DELETE FROM "DocumentChunk" WHERE "documentId" = ${documentId}`;

    // 9. Gera embeddings em batch
    console.log(`🧠 Generating embeddings...`);
    const texts = chunks.map(c => c.content);
    const embeddingResult = await generateBatchEmbeddings(texts);

    // 10. Salva chunks com embeddings no banco
    console.log(`💾 Saving ${chunks.length} chunks to database...`);
    await saveChunksToDatabase(documentId, chunks, embeddingResult.embeddings);

    // 11. Atualiza status do documento
    await prisma.document.update({
      where: { id: documentId },
      data: {
        embeddingStatus: 'completed',
        embeddingError: null,
        chunkCount: chunks.length,
        embeddedAt: new Date(),
      },
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ Document ${documentId} processed in ${processingTime}ms`);

    return {
      success: true,
      documentId,
      stats: {
        textLength: extractedText.length,
        chunkCount: chunks.length,
        processingTime,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error processing document ${documentId}:`, error);

    await updateDocumentStatus(documentId, 'failed', errorMessage);

    return {
      success: false,
      documentId,
      error: errorMessage,
    };
  }
}

// ===========================
// Batch Processing
// ===========================

/**
 * Processa multiplos documentos
 *
 * @param documentIds - Array de IDs de documentos
 * @param options - Opcoes de processamento
 * @param concurrency - Numero de documentos processados em paralelo
 * @returns Array de resultados
 */
export async function processDocuments(
  documentIds: string[],
  options: ProcessingOptions = {},
  concurrency: number = 5
): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = [];

  // Processa em batches para controle de concorrencia
  for (let i = 0; i < documentIds.length; i += concurrency) {
    const batch = documentIds.slice(i, i + concurrency);

    console.log(`📋 Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(documentIds.length / concurrency)}`);

    const batchResults = await Promise.all(
      batch.map(id => processDocument(id, options))
    );

    results.push(...batchResults);

    // Delay entre batches para evitar rate limiting
    if (i + concurrency < documentIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Processa todos os documentos pendentes
 *
 * @param limit - Numero maximo de documentos a processar
 * @returns Array de resultados
 */
export async function processPendingDocuments(
  limit: number = 100
): Promise<ProcessingResult[]> {
  const pendingDocs = await prisma.document.findMany({
    where: {
      // Documentos com R2 OU com conteúdo textual
      OR: [
        { r2Key: { not: null } },
        { content: { not: null } },
        { description: { not: null } },
        { extractedText: { not: null } },
      ],
      AND: {
        OR: [
          { embeddingStatus: null },
          { embeddingStatus: 'pending' },
          { embeddingStatus: 'failed' },
        ],
      },
    },
    select: { id: true },
    take: limit,
    orderBy: { uploadedAt: 'desc' },
  });

  console.log(`📋 Found ${pendingDocs.length} pending documents`);

  if (pendingDocs.length === 0) {
    return [];
  }

  return processDocuments(pendingDocs.map(d => d.id));
}

// ===========================
// Helper Functions
// ===========================

/**
 * Atualiza status do documento
 */
async function updateDocumentStatus(
  documentId: string,
  status: string,
  error?: string
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      embeddingStatus: status,
      embeddingError: error || null,
    },
  });
}

/**
 * Extrai texto com fallback para OCR via Gemini Vision
 */
async function extractTextWithFallback(
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ success: boolean; text: string; error?: string }> {
  // Tenta extracao normal primeiro
  const result = await extractText(fileBuffer, mimeType);

  if (result.success && result.text.length >= 100) {
    return result;
  }

  // Se texto muito curto, pode ser PDF escaneado
  // Fallback para Gemini Vision (OCR)
  if (mimeType === 'application/pdf' && result.text.length < 100) {
    console.log(`📸 Text too short (${result.text.length} chars), trying Gemini Vision OCR...`);

    try {
      const ocrText = await extractTextWithGeminiVision(fileBuffer);
      if (ocrText.length > result.text.length) {
        return { success: true, text: ocrText };
      }
    } catch (error) {
      console.error('Gemini Vision OCR failed:', error);
      // Continua com o texto original (pode ser vazio)
    }
  }

  return result;
}

/**
 * OCR via Gemini Vision para PDFs escaneados
 */
async function extractTextWithGeminiVision(pdfBuffer: Buffer): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Converte PDF buffer para base64
  const base64 = pdfBuffer.toString('base64');

  const result = await genAI.models.generateContent({
    model: PRIMARY_GEMINI_MODEL,
    contents: [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64,
        },
      },
      {
        text: `Extraia todo o texto deste documento PDF escaneado.
             Mantenha a formatacao original (paragrafos, listas, etc).
             Retorne apenas o texto extraido, sem comentarios adicionais.`,
      },
    ],
  });

  return result.text ?? '';
}

/**
 * Cria chunks baseado na categoria do documento
 */
function createChunksForDocument(
  text: string,
  category: string,
  options: ProcessingOptions
): TextChunk[] {
  const chunkOptions = {
    ...(options.chunkSize ? { maxChunkSize: options.chunkSize } : {}),
    ...(options.overlapSize ? { overlapSize: options.overlapSize } : {}),
  };

  // Usa chunker especializado por categoria
  switch (category.toLowerCase()) {
    case 'acordao':
    case 'acordao-tcu':
      return chunkTCUDocument(text, chunkOptions);

    case 'orientacao-normativa':
    case 'parecer':
    case 'parecer-vinculante':
    case 'decor':
    case 'lei':
    case 'decreto':
    case 'portaria':
    case 'manual-tcu':
      return chunkLegalDocument(text, chunkOptions);

    default:
      return chunkText(text, chunkOptions);
  }
}

/**
 * Salva chunks com embeddings no banco usando raw SQL (pgvector)
 * Insere em batches de 50 para performance
 */
async function saveChunksToDatabase(
  documentId: string,
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
      return `(gen_random_uuid(), '${documentId.replace(/'/g, "''")}', ${chunk.index}, '${escapedContent}', ${chunk.charStart}, ${chunk.charEnd}, '${embStr}'::vector, NOW(), NOW())`;
    });

    await prisma.$executeRawUnsafe(`
      INSERT INTO "DocumentChunk" (id, "documentId", "chunkIndex", content, "charStart", "charEnd", embedding, "createdAt", "updatedAt")
      VALUES ${values.join(',\n')}
    `);

    if (i + BATCH_SIZE < chunks.length) {
      console.log(`  💾 Saved ${i + BATCH_SIZE}/${chunks.length} chunks...`);
    }
  }
}

/**
 * Obtem MIME type do tipo de documento
 */
function getMimeType(type: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };

  return mimeTypes[type.toLowerCase()] || 'application/octet-stream';
}

// ===========================
// Statistics
// ===========================

/**
 * Obtem estatisticas de processamento
 */
export async function getProcessingStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalChunks: number;
}> {
  const [statusCounts, chunkCount] = await Promise.all([
    prisma.document.groupBy({
      by: ['embeddingStatus'],
      where: {
        OR: [
          { r2Key: { not: null } },
          { content: { not: null } },
          { description: { not: null } },
          { extractedText: { not: null } },
        ],
      },
      _count: true,
    }),
    prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "DocumentChunk"`,
  ]);

  const stats = {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalChunks: Number(chunkCount[0]?.count || 0),
  };

  for (const item of statusCounts) {
    const count = item._count;
    stats.total += count;

    switch (item.embeddingStatus) {
      case 'pending':
      case null:
        stats.pending += count;
        break;
      case 'processing':
        stats.processing += count;
        break;
      case 'completed':
        stats.completed += count;
        break;
      case 'failed':
        stats.failed += count;
        break;
    }
  }

  return stats;
}

// ===========================
// Export
// ===========================

const documentProcessor = {
  processDocument,
  processDocuments,
  processPendingDocuments,
  getProcessingStats,
};
export default documentProcessor;
