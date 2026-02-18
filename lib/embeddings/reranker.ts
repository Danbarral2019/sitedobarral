/**
 * Reranker com Gemini Flash
 *
 * Re-pontua os top resultados da busca vetorial usando Gemini
 * para melhorar a precisão dos resultados mais relevantes.
 *
 * Trade-off: +300-500ms de latência, mas top 5 muito mais preciso.
 * Usado apenas quando os top resultados têm similaridade próxima.
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

// ===========================
// Main Function
// ===========================

/**
 * Re-rankeia resultados usando Gemini Flash para avaliar relevância
 *
 * @param query - Pergunta original do usuário
 * @param results - Resultados da busca vetorial (já ordenados por similaridade)
 * @param topK - Quantos resultados finais retornar
 * @returns Resultados reordenados por relevância semântica
 */
export async function rerankResults(
  query: string,
  results: SearchResult[],
  topK: number = 8
): Promise<SearchResult[]> {
  // Não vale a pena rerankar poucos resultados
  if (results.length <= topK) return results;

  // Só rerankear se os top resultados têm similaridade próxima
  // (quando a diferença é grande, o ranking vetorial já é bom)
  const topSimilarity = results[0]?.similarity || 0;
  const fifthSimilarity = results[Math.min(4, results.length - 1)]?.similarity || 0;
  if (topSimilarity - fifthSimilarity > 0.15) {
    // Ranking claro — não precisa rerankar
    return results.slice(0, topK);
  }

  // Pegar os top 20 para rerankar (não faz sentido enviar mais)
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
    // Extrair JSON do markdown se necessário
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    const scores: RerankScore[] = JSON.parse(text);

    // Reordenar por score do Gemini
    const reranked: SearchResult[] = [];
    const usedIndices = new Set<number>();

    for (const { index, score } of scores.sort((a, b) => b.score - a.score)) {
      const i = index - 1; // Convert to 0-based
      if (i >= 0 && i < candidates.length && !usedIndices.has(i)) {
        usedIndices.add(i);
        reranked.push({
          ...candidates[i],
          similarity: score / 100, // Normalizar para 0-1
        });
      }
      if (reranked.length >= topK) break;
    }

    // Se o parse falhou parcialmente, completar com os restantes
    if (reranked.length < topK) {
      for (let i = 0; i < candidates.length && reranked.length < topK; i++) {
        if (!usedIndices.has(i)) {
          reranked.push(candidates[i]);
        }
      }
    }

    return reranked;
  } catch (err) {
    console.warn('Reranking failed, falling back to vector ranking:', err instanceof Error ? err.message : err);
    return results.slice(0, topK);
  }
}
