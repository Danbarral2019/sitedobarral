import type { SearchResult } from '@/lib/embeddings/vector-search';
import type { SearchResultItem } from '@/lib/types/global-search';

/** Pós-filtro de acesso: documento aparece se comum, sem curso, ou de curso matriculado. */
export function filterByEnrollment(
  results: SearchResult[],
  enrolledCourseIds: string[],
): SearchResult[] {
  const enrolled = new Set(enrolledCourseIds);
  return results.filter(
    (r) => r.isCommon || !r.courseId || enrolled.has(r.courseId),
  );
}

/** Deduplica por documentId: mantém o chunk de maior similarity, na ordem de 1ª aparição. */
export function dedupeByDocument(results: SearchResult[]): SearchResult[] {
  const best = new Map<string, SearchResult>();
  const order: string[] = [];
  for (const r of results) {
    const existing = best.get(r.documentId);
    if (!existing) {
      best.set(r.documentId, r);
      order.push(r.documentId);
    } else if (r.similarity > existing.similarity) {
      best.set(r.documentId, r);
    }
  }
  return order.map((id) => best.get(id)!);
}

/** Prioridade de exibição por tipo (espelha o global-search). Menor = mais acima. */
export const TYPE_PRIORITY: Record<string, number> = {
  glossary: 1,
  faq: 1.5,
  'course-material': 2,
  document: 3,
  'legislative-act': 4,
  lei: 5,
  video: 6,
  blog: 6.5,
  site: 7,
};

/** Ordena por prioridade de tipo, ESTÁVEL (preserva a ordem interna — ex.: relevância do híbrido). */
export function sortByTypePriority(items: SearchResultItem[]): SearchResultItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const pa = TYPE_PRIORITY[a.item.type] ?? 10;
      const pb = TYPE_PRIORITY[b.item.type] ?? 10;
      return pa !== pb ? pa - pb : a.i - b.i; // desempate por índice = estável
    })
    .map(({ item }) => item);
}
