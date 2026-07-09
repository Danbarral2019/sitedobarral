/**
 * Tipos compartilhados da pipeline de resposta do assistente (RAG).
 *
 * Extraídos de `app/api/documents/query/route.ts` (Fase 1 —
 * `docs/PLANO_FASE1_ANSWERSERVICE.md`) para serem consumidos tanto pela rota
 * de produção quanto pelo `assembleAnswerContext` e pelo harness de avaliação.
 */
import type { QueryScope } from './domain-detection';
import type { LegalSource } from '@/lib/legal-context';
import type { SearchResult } from '@/lib/embeddings/vector-search';
import type { AiDocument } from '@/lib/ai/types';

export interface QueryFilters {
  courseId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  isPublic?: boolean;
  ticMode?: boolean;
  /**
   * Escopo da pesquisa controlado pelo aluno via chips no ChatInterface:
   * - 'all' (default): comportamento padrão, detector strong-labor decide o boost TST
   * - 'tst-only': apenas TribunalDecision com tribunalCode=TST (skipDocument + skipLegAct + skipFts)
   * - 'no-tst': sem ramo TST (Document + LegislativeAct apenas), sem boost
   */
  scope?: QueryScope;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DocumentResult {
  documentId: string;
  title: string;
  category: string;
  geminiResponse: string;
  relevance: number;
  excerpt: string;
  url?: string;
  uploadedAt: string;
  tags?: string[];
  courseIds?: string[];
}

/** Entrada de `assembleAnswerContext` — o que a rota já parseou/validou do body. */
export interface AssembleAnswerInput {
  query: string;
  filters: QueryFilters;
  maxResults: number;
  conversationHistory?: ConversationMessage[];
  useCache: boolean;
  /**
   * IDs dos cursos em que o usuário está matriculado (BIA-0c). Quando fornecido,
   * os resultados de retrieval são pós-filtrados por matrícula antes de montar
   * as fontes/contexto — mesma regra do BIA-0b na lista (`filterByEnrollment`):
   * mantém documentos comuns/públicos e os do(s) curso(s) matriculado(s),
   * removendo material restrito de cursos não matriculados. Admin recebe todos
   * os cursos. Quando OMITIDO (ex.: harness de eval), nenhum filtro é aplicado —
   * preserva o comportamento de medição de retrieval.
   */
  enrolledCourseIds?: string[];
}

/**
 * Saída determinística de `assembleAnswerContext`: tudo o que a rota (streaming
 * e non-streaming) e o eval precisam para gerar a resposta e montar o payload.
 * `empty` sinaliza o caso "sem resultados de busca" (o caller retorna a resposta
 * vazia apropriada).
 */
export interface AnswerContext {
  empty: boolean;
  cached: boolean;
  totalFound: number;
  systemInstruction: string;
  synthesisPrompt: string;
  formattedResults: DocumentResult[];
  legalSources: LegalSource[];
  allDisplayResults: SearchResult[];
  maxSimilarity: number;
  /**
   * Fontes discretas para a Citations API (Fase 3): chunks recuperados +
   * artigos da Lei + atos, cada um como {title, text} citável. O índice em
   * `documents` é o que a citação referencia (documentIndex).
   */
  citationDocuments: AiDocument[];
}
