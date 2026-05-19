/**
 * Helpers puros pro TCU Manager.
 *
 * Funcoes de mapeamento de dados (validation -> import, course IDs -> slugs,
 * validation -> excel rows). Browser-side download fica no caller.
 */

import { courses } from '@/data/courses';

export interface ValidationDocLike {
  title: string;
  description: string;
  category: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
  warnings: string[];
  rowIndex: number;
  rawData: Record<string, unknown>;
}

export interface ImportDocPayload {
  title: unknown;
  description: unknown;
  category: unknown;
  course: unknown;
  tags: unknown;
  publico: unknown;
  url: unknown;
  arquivo: unknown;
  isDuplicate: boolean;
}

export function courseIdsToSlugs(courseIds: string[]): string {
  return courseIds
    .map((id) => courses.find((c) => c.id === id)?.slug)
    .filter(Boolean)
    .join(',');
}

export interface ValidationExcelRow {
  '#': number;
  Status: string;
  Titulo: unknown;
  Descricao: unknown;
  Categoria: unknown;
  Curso: unknown;
  Tags: unknown;
  Publico: unknown;
  URL: unknown;
  Arquivo: unknown;
  Avisos: string;
}

export function buildValidationExcelData(docs: ValidationDocLike[]): ValidationExcelRow[] {
  return docs.map((doc, index) => {
    const raw = doc.rawData;
    const status = doc.isDuplicate ? '🔄 DUPLICATA' : doc.isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO';
    return {
      '#': index + 1,
      Status: status,
      Titulo: doc.title || raw['Titulo'] || raw['titulo'] || raw['Assunto'] || '',
      Descricao: doc.description || raw['Descricao'] || raw['descricao'] || raw['Ementa'] || '',
      Categoria: doc.category || raw['Categoria'] || 'acordao',
      Curso: raw['Curso'] || raw['curso'] || '',
      Tags: raw['Tags'] || raw['tags'] || '',
      Publico: raw['Publico'] || raw['publico'] || 'SIM',
      URL: raw['URL'] || raw['url'] || '',
      Arquivo: raw['Arquivo'] || raw['arquivo'] || '',
      Avisos: [...doc.errors, ...doc.warnings].join('; '),
    };
  });
}

export const VALIDATION_EXCEL_COLUMN_WIDTHS = [
  { wch: 5 }, // #
  { wch: 15 }, // Status
  { wch: 60 }, // Titulo
  { wch: 80 }, // Descricao
  { wch: 15 }, // Categoria
  { wch: 30 }, // Curso
  { wch: 30 }, // Tags
  { wch: 10 }, // Publico
  { wch: 50 }, // URL
  { wch: 30 }, // Arquivo
  { wch: 50 }, // Avisos
] as const;

export function mapValidationToImport(docs: ValidationDocLike[]): ImportDocPayload[] {
  return docs
    .filter((doc) => doc.isValid)
    .map((doc) => {
      const raw = doc.rawData;
      return {
        title: doc.title || raw['Titulo'] || raw['titulo'] || raw['Assunto'] || '',
        description: doc.description || raw['Descricao'] || raw['descricao'] || raw['Ementa'] || '',
        category: doc.category || raw['Categoria'] || raw['categoria'] || 'acordao',
        course: raw['Curso'] || raw['curso'] || '',
        tags: raw['Tags'] || raw['tags'] || '',
        publico: raw['Publico'] || raw['publico'] || 'SIM',
        url: raw['URL'] || raw['url'] || '',
        arquivo: raw['Arquivo'] || raw['arquivo'] || '',
        isDuplicate: doc.isDuplicate,
      };
    });
}
