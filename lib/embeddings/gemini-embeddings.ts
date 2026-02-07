/**
 * Gemini Embeddings Client
 *
 * Wrapper para o modelo gemini-embedding-001 da Google
 * Free tier: 1500 req/min
 *
 * Documentacao: https://ai.google.dev/gemini-api/docs/embeddings
 */

import { GoogleGenerativeAI, type EmbedContentRequest, type BatchEmbedContentsRequest } from '@google/generative-ai';

// ===========================
// Configuration
// ===========================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSION = 768; // Nosso banco usa vector(768); gemini-embedding-001 default é 3072

// Lazy-loaded client
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

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
 * @returns Embedding como array de numeros (768 dimensoes)
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });

  // outputDimensionality não está nos tipos do SDK mas a API aceita o campo
  const request = {
    content: { parts: [{ text }], role: 'user' as const },
    outputDimensionality: EMBEDDING_DIMENSION,
  } as EmbedContentRequest;

  const result = await model.embedContent(request);
  const embedding = result.embedding.values;

  return {
    embedding,
    model: EMBEDDING_MODEL,
    dimension: EMBEDDING_DIMENSION,
  };
}

// ===========================
// Batch Embeddings
// ===========================

/**
 * Gera embeddings para multiplos textos em batch
 *
 * Otimizado para processar ate 100 textos por chamada
 * Rate limit: 1500 req/min (free tier)
 *
 * @param texts - Array de textos para gerar embeddings
 * @returns Array de embeddings (mesma ordem dos textos)
 */
export async function generateBatchEmbeddings(
  texts: string[]
): Promise<BatchEmbeddingResult> {
  if (!texts || texts.length === 0) {
    throw new Error('Texts array cannot be empty');
  }

  // Filtra textos vazios
  const validTexts = texts.filter(t => t && t.trim().length > 0);

  if (validTexts.length === 0) {
    throw new Error('All texts are empty');
  }

  const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });

  // Processa em batches de 100 (limite recomendado da API)
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE);

    // outputDimensionality não está nos tipos do SDK mas a API aceita o campo
    const batchRequest = {
      requests: batch.map(text => ({
        content: { parts: [{ text }], role: 'user' as const },
        outputDimensionality: EMBEDDING_DIMENSION,
      })),
    } as BatchEmbedContentsRequest;

    const result = await model.batchEmbedContents(batchRequest);

    const batchEmbeddings = result.embeddings.map(e => e.values);
    allEmbeddings.push(...batchEmbeddings);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < validTexts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    embeddings: allEmbeddings,
    model: EMBEDDING_MODEL,
    dimension: EMBEDDING_DIMENSION,
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
 * @returns Embedding da query
 */
export async function generateQueryEmbedding(query: string): Promise<EmbeddingResult> {
  // Adiciona contexto de busca para melhorar relevancia
  const contextualQuery = `search_query: ${query}`;
  return generateEmbedding(contextualQuery);
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
  batchSize: 100, // Textos por batch
  rateLimit: 1500, // Requisicoes por minuto (free tier)
} as const;

// ===========================
// Export
// ===========================

export default {
  generateEmbedding,
  generateBatchEmbeddings,
  generateQueryEmbedding,
  cosineSimilarity,
  embeddingToSql,
  sqlToEmbedding,
  EMBEDDING_CONFIG,
};
