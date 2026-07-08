import type { SearchResult } from '@/lib/embeddings/vector-search';
import type { SearchResultItem } from '@/lib/types/global-search';
import type { DocumentResult, LegislativeActResult } from '@/lib/types/global-search';
import { courses } from '@/data/courses';

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

export interface DocRow {
  id: string; title: string; description: string | null; category: string;
  type: string; url: string | null; courseId: string | null; tags: string | null;
  uploadedAt: Date; isPublic: boolean;
}

export interface ActRow {
  id: string; type: string; fullNumber: string; title: string; ementa: string;
  summary: string | null; issuer: string; publishDate: Date; hierarchyLevel: number;
  leiArticlesArr: string[]; officialUrl: string | null; pdfUrl: string | null;
}

function courseName(courseId: string | null): string | undefined {
  if (!courseId) return undefined;
  return courses.find((c) => c.id === courseId)?.title || 'Curso';
}

export function mapDocumentRowToResult(row: DocRow): DocumentResult {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    type: row.type,
    url: row.url,
    courseId: row.courseId,
    courseName: courseName(row.courseId),
    tags: row.tags,
    uploadedAt: row.uploadedAt.toISOString(),
    isPublic: row.isPublic,
  };
}

export function mapActRowToResult(row: ActRow): LegislativeActResult {
  return {
    id: row.id,
    type: row.type,
    fullNumber: row.fullNumber,
    title: row.title,
    ementa: row.ementa,
    summary: row.summary,
    issuer: row.issuer,
    publishDate: row.publishDate.toISOString(),
    hierarchyLevel: row.hierarchyLevel,
    leiArticles: row.leiArticlesArr,
    officialUrl: row.officialUrl,
    pdfUrl: row.pdfUrl,
  };
}

/**
 * Mescla a lista FTS com os resultados híbridos: substitui TODAS as seções
 * document + legislative-act pelas híbridas (na ordem de relevância do híbrido),
 * mantém os demais tipos do FTS e reordena por prioridade de tipo (estável).
 * Se `hybrid` estiver vazio, devolve o FTS ordenado (sem esvaziar nada).
 */
export function mergeHybridIntoResults(
  fts: SearchResultItem[],
  hybrid: SearchResultItem[],
): SearchResultItem[] {
  if (hybrid.length === 0) return sortByTypePriority(fts);
  const HYBRID_TYPES = new Set(['document', 'legislative-act']);
  const kept = fts.filter((i) => !HYBRID_TYPES.has(i.type));
  return sortByTypePriority([...kept, ...hybrid]);
}
