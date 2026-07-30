/**
 * Embeddings Module - Busca Semantica com pgvector
 *
 * Este modulo substitui o Gemini File API por um sistema de busca
 * semantica baseado em embeddings armazenados no PostgreSQL com pgvector.
 *
 * Componentes:
 * - gemini-embeddings: Gera embeddings via Gemini (default gemini-embedding-2-preview, env EMBEDDING_MODEL)
 * - text-chunker: Divide textos em chunks com overlap
 * - document-processor: Pipeline completo de processamento
 * - vector-search: Busca por similaridade coseno
 *
 * Fluxo:
 *   UPLOAD: PDF → R2 → Extrair Texto → Chunking → Embeddings → pgvector
 *   QUERY:  Pergunta → Embedding → Busca vetorial → Contexto → Gemini → Resposta
 */

// Gemini Embeddings
export {
  generateEmbedding,
  generateBatchEmbeddings,
  generateQueryEmbedding,
  cosineSimilarity,
  embeddingToSql,
  sqlToEmbedding,
  EMBEDDING_CONFIG,
} from './gemini-embeddings';

// Text Chunker
export {
  chunkText,
  chunkLegalDocument,
  chunkTCUDocument,
  type TextChunk,
  type ChunkOptions,
} from './text-chunker';

// Document Processor
export {
  processDocument,
  processDocuments,
  processPendingDocuments,
  getProcessingStats,
  type ProcessingResult,
  type ProcessingOptions,
} from './document-processor';

// Vector Search
export {
  semanticSearch,
  findRelatedDocuments,
  searchByLeiArticle,
  multiQuerySearch,
  buildContextForLLM,
  formatSources,
  type SearchResult,
  type SearchOptions,
  type SearchResponse,
} from './vector-search';
