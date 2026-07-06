/**
 * Helpers puros da pipeline de resposta do assistente (RAG).
 *
 * Extraídos verbatim de `app/api/documents/query/route.ts` (Fase 1 do plano de
 * retomada — `docs/PLANO_FASE1_ANSWERSERVICE.md`), para permitir reuso pela rota
 * de produção e pelo harness de avaliação de síntese (`eval/`).
 *
 * Sem efeitos colaterais nem I/O — apenas transformação de dados.
 */
import type { SearchResult } from '@/lib/embeddings/vector-search';

/**
 * Hash determinístico e estável de uma string (base36). Usado para chaves de
 * cache de query. Não é criptográfico.
 */
export function hashQueryStr(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Diversify results with priority tiers:
 * Tier 1: Professor's materials (apostila, conteudo-programatico, outro, bibliografia, sumula, parecer)
 * Tier 2: Enunciados + ONs AGU (enunciados, orientacao-normativa)
 * Tier 3: Acórdãos TCU + Manual TCU (acordao, manual-tcu)
 * Tier 4: Pareceres AGU (decor, parecer-vinculante)
 *
 * Within each tier, picks best by similarity. Then fills remaining by similarity.
 */
export function diversifyResults(results: SearchResult[], maxResults: number): SearchResult[] {
  if (results.length <= maxResults) return results;

  // Priority tiers (lower = higher priority)
  const CATEGORY_TIER: Record<string, number> = {
    'apostila': 1,
    'conteudo-programatico': 1,
    'outro': 1,
    'bibliografia': 1,
    'parecer': 1,
    'enunciados': 2,
    'orientacao-normativa': 2,
    'sumula': 2,
    'acordao': 3,
    'manual-tcu': 3,
    'consulta_tcu': 3,
    'informativo': 3,
    'decor': 4,
    'parecer-vinculante': 4,
  };

  // Per-category caps
  const CATEGORY_CAPS: Record<string, number> = {
    'manual-tcu': 1,
  };
  const DEFAULT_CAP = 3;
  const getCap = (cat: string) => CATEGORY_CAPS[cat] ?? DEFAULT_CAP;
  const getTier = (cat: string) => CATEGORY_TIER[cat] ?? 5;

  const byCategory = new Map<string, SearchResult[]>();
  for (const r of results) {
    const arr = byCategory.get(r.category) || [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }

  const diverse: SearchResult[] = [];
  const usedIds = new Set<string>();
  const categoryCounts = new Map<string, number>();

  // Sort categories by tier priority, then pick best from each
  const sortedCategories = [...byCategory.entries()].sort(
    (a, b) => getTier(a[0]) - getTier(b[0])
  );

  // Phase 1: Best result from each category, in tier order
  for (const [, items] of sortedCategories) {
    if (diverse.length >= maxResults) break;
    diverse.push(items[0]);
    usedIds.add(items[0].documentId);
    categoryCounts.set(items[0].category, 1);
  }

  // Phase 2: Fill remaining slots respecting caps, prioritizing by tier then similarity
  const remaining = results
    .filter(r => !usedIds.has(r.documentId))
    .sort((a, b) => {
      const tierDiff = getTier(a.category) - getTier(b.category);
      if (tierDiff !== 0) return tierDiff;
      return b.similarity - a.similarity;
    });

  for (const r of remaining) {
    if (diverse.length >= maxResults) break;
    const catCount = categoryCounts.get(r.category) || 0;
    if (catCount >= getCap(r.category)) continue;
    diverse.push(r);
    usedIds.add(r.documentId);
    categoryCounts.set(r.category, catCount + 1);
  }

  // Phase 3: If still under maxResults, relax caps by +1
  if (diverse.length < maxResults) {
    for (const r of results) {
      if (diverse.length >= maxResults) break;
      if (usedIds.has(r.documentId)) continue;
      const catCount = categoryCounts.get(r.category) || 0;
      if (catCount >= getCap(r.category) + 1) continue;
      diverse.push(r);
      usedIds.add(r.documentId);
      categoryCounts.set(r.category, catCount + 1);
    }
  }

  return diverse.slice(0, maxResults);
}

/**
 * Generate excerpt from chunk content
 */
export function generateExcerpt(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');

  if (lastPeriod > maxLength * 0.7) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '...';
}
