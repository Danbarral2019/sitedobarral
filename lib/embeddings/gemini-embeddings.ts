/**
 * Gemini Embeddings Client
 *
 * Wrapper para o modelo de embeddings da Google (Gemini)
 * Paid tier: ~10k req/min (ver ROADMAP_GEMINI_PAGO.md Fase 4)
 *
 * Modelo configuravel via env var EMBEDDING_MODEL (default: gemini-embedding-2-preview)
 * Documentacao: https://ai.google.dev/gemini-api/docs/embeddings
 */

import { GoogleGenAI } from '@google/genai';
import { withGeminiKeyFallback } from '@/lib/gemini/api-key-fallback';

// ===========================
// Configuration
// ===========================

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-2-preview';
const EMBEDDING_DIMENSION = 768; // Nosso banco usa vector(768); Matryoshka truncation

// Cliente instanciado por chamada via withGeminiKeyFallback (sem cache em
// memória) para suportar fallback entre GEMINI_API_KEY e GEMINI_API_KEY_BACKUP.
// Custo desprezível: SDK só abre conexão na primeira chamada de método.

// ===========================
// Types
// ===========================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimension: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  dimension: number;
  count: number;
}

// ===========================
// Single Embedding
// ===========================

/**
 * Gera embedding para um texto
 *
 * @param text - Texto para gerar embedding (max ~8000 tokens)
 * @param dimension - Dimensao do embedding (default 768; Matryoshka permite truncar p/ 1536 etc.)
 * @returns Embedding como array de numeros
 */
export async function generateEmbedding(
  text: string,
  dimension: number = EMBEDDING_DIMENSION,
): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  return withGeminiKeyFallback(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        outputDimensionality: dimension,
      },
    });

    const embedding = result.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error('No embedding returned from Gemini API');
    }

    return {
      embedding,
      model: EMBEDDING_MODEL,
      dimension,
    };
  });
}

// ===========================
// Batch Embeddings
// ===========================

/**
 * Gera embeddings para multiplos textos em batch
 *
 * Otimizado para processar ate 250 textos por chamada (tier pago)
 * Rate limit: ~10k req/min (paid tier)
 *
 * @param texts - Array de textos para gerar embeddings
 * @param dimension - Dimensao do embedding (default 768; Matryoshka permite truncar p/ 1536 etc.)
 * @returns Array de embeddings (mesma ordem dos textos)
 */
export async function generateBatchEmbeddings(
  texts: string[],
  dimension: number = EMBEDDING_DIMENSION,
): Promise<BatchEmbeddingResult> {
  if (!texts || texts.length === 0) {
    throw new Error('Texts array cannot be empty');
  }

  // Filtra textos vazios
  const validTexts = texts.filter(t => t && t.trim().length > 0);

  if (validTexts.length === 0) {
    throw new Error('All texts are empty');
  }

  // Gemini API limita BatchEmbedContentsRequest a 100 requests por call (limite hard,
  // independente do tier). Tentativa de 250 falhava com 400 INVALID_ARGUMENT em
  // atos grandes (Portaria SGD/MGI 1.070/2023 e 5.950/2023, ~200 chunks cada).
  // Fix descoberto em 2026-04-25 quando rodando index-legislative-acts.
  const BATCH_SIZE = 100;

  const allEmbeddings = await withGeminiKeyFallback(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const result: number[][] = [];

    for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
      const batch = validTexts.slice(i, i + BATCH_SIZE);

      // embedContent com contents como array retorna multiple embeddings
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch.map(text => ({ role: 'user' as const, parts: [{ text }] })),
        config: {
          outputDimensionality: dimension,
        },
      });

      if (!response.embeddings || response.embeddings.length !== batch.length) {
        throw new Error(`Expected ${batch.length} embeddings, got ${response.embeddings?.length ?? 0}`);
      }

      for (const emb of response.embeddings) {
        if (!emb.values) {
          throw new Error('No embedding values returned from Gemini API in batch');
        }
        result.push(emb.values);
      }

      // Small delay between batches to avoid rate limiting (tier pago, ROADMAP_GEMINI_PAGO.md Fase 4)
      if (i + BATCH_SIZE < validTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }

    return result;
  });

  return {
    embeddings: allEmbeddings,
    model: EMBEDDING_MODEL,
    dimension,
    count: allEmbeddings.length,
  };
}

// ===========================
// Query Embedding
// ===========================

/**
 * Gera embedding otimizado para queries (busca)
 *
 * O Gemini usa o mesmo modelo para query e documentos,
 * mas esta funcao adiciona prefixo de contexto para melhorar resultados
 *
 * @param query - Texto da pergunta/busca
 * @param dimension - Dimensao do embedding (default 768; Matryoshka permite truncar p/ 1536 etc.)
 * @returns Embedding da query
 */
export async function generateQueryEmbedding(
  query: string,
  dimension: number = EMBEDDING_DIMENSION,
): Promise<EmbeddingResult> {
  // Adiciona contexto de busca para melhorar relevancia
  const contextualQuery = `search_query: ${query}`;
  return generateEmbedding(contextualQuery, dimension);
}

// ===========================
// Utility Functions
// ===========================

/**
 * Calcula similaridade coseno entre dois embeddings
 *
 * @param a - Primeiro embedding
 * @param b - Segundo embedding
 * @returns Similaridade entre 0 e 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Converte embedding para formato SQL (pgvector)
 *
 * @param embedding - Array de numeros
 * @returns String no formato '[0.1, 0.2, ...]'
 */
export function embeddingToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Converte string SQL para embedding
 *
 * @param sql - String no formato '[0.1, 0.2, ...]'
 * @returns Array de numeros
 */
export function sqlToEmbedding(sql: string): number[] {
  const cleaned = sql.replace(/[\[\]]/g, '');
  return cleaned.split(',').map(Number);
}

// ===========================
// Constants
// ===========================

export const EMBEDDING_CONFIG = {
  model: EMBEDDING_MODEL,
  dimension: EMBEDDING_DIMENSION,
  maxTokens: 8000, // Limite aproximado de tokens por texto
  batchSize: 250, // Textos por batch (tier pago)
  rateLimit: 10000, // Requisicoes por minuto (paid tier; free era 1500)
} as const;

// ===========================
// Export
// ===========================

const geminiEmbeddings = {
  generateEmbedding,
  generateBatchEmbeddings,
  generateQueryEmbedding,
  cosineSimilarity,
  embeddingToSql,
  sqlToEmbedding,
  EMBEDDING_CONFIG,
};
export default geminiEmbeddings;
