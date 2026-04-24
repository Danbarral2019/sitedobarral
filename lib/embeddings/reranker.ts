/**
 * Rerankers para re-pontuar resultados de busca.
 *
 * Dois providers:
 * - Gemini Flash (LLM-based, prompt scoring)
 * - Cohere Rerank 3.5 (cross-encoder treinado para ranking)
 *
 * Configurável via env: RERANK_PROVIDER=cohere|gemini (default: gemini)
 */

import { queryGeminiText } from '../gemini/cached-client';
import type { SearchResult } from './vector-search';

// ===========================
// Types
// ===========================

interface RerankScore {
  index: number;
  score: number;
}

type RerankProvider = 'gemini' | 'cohere';

/**
 * Lê o provider por chamada (não por module-load) — o CLI de eval seta
 * `process.env.RERANK_PROVIDER = 'cohere'` dentro do `main()`, ou seja, depois
 * dos imports ESM terem sido hoisted. Ler em runtime garante que o flag
 * `--cohere` realmente mude o caminho.
 */
function getRerankProvider(): RerankProvider {
  return (process.env.RERANK_PROVIDER as RerankProvider) || 'gemini';
}

// ===========================
// Main Function
// ===========================

/**
 * Re-rankeia resultados usando o provider configurado (env RERANK_PROVIDER).
 *
 * @param query - Pergunta original do usuário
 * @param results - Resultados da busca (já ordenados por RRF score)
 * @param topK - Quantos resultados finais retornar
 * @returns Resultados reordenados por relevância semântica
 */
export async function rerankResults(
  query: string,
  results: SearchResult[],
  topK: number = 8
): Promise<SearchResult[]> {
  if (results.length <= Math.min(topK, 3)) return results.slice(0, topK);

  const provider = getRerankProvider();
  if (provider === 'cohere' && process.env.COHERE_API_KEY) {
    return rerankWithCohere(query, results, topK);
  }
  return rerankWithGemini(query, results, topK);
}

// ===========================
// Cohere Rerank 3.5
// ===========================

async function rerankWithCohere(
  query: string,
  results: SearchResult[],
  topK: number
): Promise<SearchResult[]> {
  const candidates = results.slice(0, 40);

  try {
    const { CohereClient } = await import('cohere-ai');
    const cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });

    const documents = candidates.map((r) => {
      const content = r.chunkContent.slice(0, 500);
      return `[${r.category}] ${r.documentTitle}\n${content}`;
    });

    const response = await cohere.v2.rerank({
      model: 'rerank-v3.5',
      query,
      documents,
      topN: topK,
    });

    const reranked: SearchResult[] = response.results.map((rr) => ({
      ...candidates[rr.index],
      similarity: rr.relevanceScore,
    }));

    return reranked;
  } catch (err) {
    console.warn('Cohere reranking failed, falling back to Gemini:', err instanceof Error ? err.message : err);
    return rerankWithGemini(query, results, topK);
  }
}

// ===========================
// Gemini Flash (LLM-based)
// ===========================

async function rerankWithGemini(
  query: string,
  results: SearchResult[],
  topK: number
): Promise<SearchResult[]> {
  const candidates = results.slice(0, 20);

  const prompt = `Dado a pergunta do usuário sobre Licitações e Contratos (Lei 14.133/2021), ordene os documentos abaixo por relevância.

PERGUNTA: "${query}"

DOCUMENTOS:
${candidates.map((r, i) => {
  const yearStr = r.uploadedAt ? new Date(r.uploadedAt).getFullYear().toString() : '?';
  return `${i + 1}. [${r.category} | ${yearStr}] ${r.documentTitle}: ${r.chunkContent.slice(0, 150)}`;
}).join('\n')}

CRITÉRIOS DE ORDENAÇÃO:
- Priorize fontes mais recentes e que referenciem a Lei 14.133/2021
- Fontes baseadas na Lei 8.666/1993 devem ter score menor, salvo se ainda aplicáveis
- Enunciados, orientações normativas e apostilas são fontes de alto valor

Responda APENAS com um JSON array de objetos com "index" (1-based) e "score" (0-100):
[{"index": 1, "score": 95}, {"index": 2, "score": 80}, ...]

Ordene do mais relevante ao menos relevante. Inclua TODOS os ${candidates.length} documentos.`;

  try {
    const response = await queryGeminiText(prompt, {
      temperature: 0.1,
      maxOutputTokens: 512,
      useCache: true,
    });

    let text = response.response.trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const scores: RerankScore[] = JSON.parse(text);

    const reranked: SearchResult[] = [];
    const usedIndices = new Set<number>();

    for (const { index, score } of scores.sort((a, b) => b.score - a.score)) {
      const i = index - 1;
      if (i >= 0 && i < candidates.length && !usedIndices.has(i)) {
        usedIndices.add(i);
        reranked.push({
          ...candidates[i],
          similarity: score / 100,
        });
      }
      if (reranked.length >= topK) break;
    }

    if (reranked.length < topK) {
      for (let i = 0; i < candidates.length && reranked.length < topK; i++) {
        if (!usedIndices.has(i)) {
          reranked.push(candidates[i]);
        }
      }
    }

    return reranked;
  } catch (err) {
    console.warn('Gemini reranking failed, falling back to vector ranking:', err instanceof Error ? err.message : err);
    return results.slice(0, topK);
  }
}
