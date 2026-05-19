/**
 * Funcoes puras de export de documentos.
 *
 * O caller (page) cuida do download via URL.createObjectURL + link.click().
 * Aqui sao apenas funcoes puras que retornam strings testaveis.
 */

import type { DocumentData } from '@/components/admin/DocumentCard';
import type { Course } from '@/lib/types';

export type ExportFormat = 'json' | 'csv';

const CSV_HEADERS = ['Titulo', 'Descricao', 'Curso', 'Categoria', 'Tipo', 'Publico', 'Data'] as const;

export function buildExportFilename(format: ExportFormat, now: Date = new Date()): string {
  const datePart = now.toISOString().split('T')[0];
  return `documentos-${datePart}.${format}`;
}

export function filterDocumentsBySelection(
  documents: DocumentData[],
  selectedIds: Set<string>,
): DocumentData[] {
  if (selectedIds.size === 0) return documents;
  return documents.filter((doc) => selectedIds.has(doc.id));
}

export function documentsToJson(documents: DocumentData[]): string {
  return JSON.stringify(documents, null, 2);
}

function resolveCourseName(doc: DocumentData, courses: Course[]): string {
  if (doc.courseId) {
    const course = courses.find((c) => c.id === doc.courseId);
    if (course) return course.title;
  }
  return doc.isCommon ? 'Todos os cursos' : '';
}

function escapeCsvCell(value: string): string {
  return `"${value}"`;
}

export function documentsToCsv(documents: DocumentData[], courses: Course[]): string {
  const rows = documents.map((doc) => [
    doc.title,
    doc.description || '',
    resolveCourseName(doc, courses),
    doc.category,
    doc.type,
    doc.isPublic ? 'Sim' : 'Nao',
    new Date(doc.uploadedAt).toLocaleDateString('pt-BR'),
  ]);

  return [
    CSV_HEADERS.join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

/**
 * Helper de DOM para download. Sem teste unitario (depende de DOM real).
 * Coabita com as funcoes puras pra manter export logic colocada.
 */
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
