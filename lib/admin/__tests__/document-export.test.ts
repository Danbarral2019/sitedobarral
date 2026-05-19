/**
 * Testes para lib/admin/document-export.ts
 *
 * Funcoes puras de export de documentos para JSON e CSV.
 * As funcoes retornam strings; o caller (page) cuida do download via DOM.
 */

import { describe, it, expect } from 'vitest';
import {
  documentsToJson,
  documentsToCsv,
  buildExportFilename,
  filterDocumentsBySelection,
} from '../document-export';
import type { DocumentData } from '@/components/admin/DocumentCard';
import type { Course } from '@/lib/types';

function makeDoc(overrides: Partial<DocumentData> = {}): DocumentData {
  return {
    id: 'doc-1',
    title: 'Titulo',
    description: 'Descricao',
    category: 'acordao',
    type: 'pdf',
    url: 'https://example.com/d.pdf',
    isPublic: true,
    isCommon: false,
    courseId: null,
    uploadedAt: '2026-05-19T10:00:00.000Z',
    tags: '[]',
    leiArticles: '[]',
    ...overrides,
  } as DocumentData;
}

const mockCourses = [
  { id: '1', title: 'Curso A', slug: 'curso-a' },
  { id: '2', title: 'Curso B', slug: 'curso-b' },
] as Course[];

describe('buildExportFilename', () => {
  it('gera filename com data ISO e extensao json', () => {
    const filename = buildExportFilename('json', new Date('2026-05-19T00:00:00Z'));
    expect(filename).toBe('documentos-2026-05-19.json');
  });

  it('gera filename com extensao csv', () => {
    const filename = buildExportFilename('csv', new Date('2026-01-02T00:00:00Z'));
    expect(filename).toBe('documentos-2026-01-02.csv');
  });
});

describe('filterDocumentsBySelection', () => {
  it('retorna todos os docs quando selectedIds esta vazio', () => {
    const docs = [makeDoc({ id: 'a' }), makeDoc({ id: 'b' })];
    expect(filterDocumentsBySelection(docs, new Set())).toEqual(docs);
  });

  it('retorna so os selecionados quando selectedIds nao vazio', () => {
    const docs = [makeDoc({ id: 'a' }), makeDoc({ id: 'b' }), makeDoc({ id: 'c' })];
    const result = filterDocumentsBySelection(docs, new Set(['a', 'c']));
    expect(result.map((d) => d.id)).toEqual(['a', 'c']);
  });
});

describe('documentsToJson', () => {
  it('retorna JSON com indent 2', () => {
    const docs = [makeDoc({ id: 'a', title: 'Aaa' })];
    const json = documentsToJson(docs);
    expect(json).toContain('  "id": "a"');
    expect(json).toContain('  "title": "Aaa"');
  });

  it('serializa array vazio como []', () => {
    expect(documentsToJson([])).toBe('[]');
  });

  it('preserva todos os campos do doc', () => {
    const doc = makeDoc({ id: 'x', title: 'X', isPublic: false });
    const parsed = JSON.parse(documentsToJson([doc]));
    expect(parsed[0]).toMatchObject({ id: 'x', title: 'X', isPublic: false });
  });
});

describe('documentsToCsv', () => {
  it('inclui header com 7 colunas em PT-BR', () => {
    const csv = documentsToCsv([], mockCourses);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('Titulo,Descricao,Curso,Categoria,Tipo,Publico,Data');
  });

  it('mapeia courseId numerico para titulo do curso', () => {
    const doc = makeDoc({ courseId: '1' });
    const csv = documentsToCsv([doc], mockCourses);
    expect(csv).toContain('"Curso A"');
  });

  it('mapeia isCommon=true para "Todos os cursos"', () => {
    const doc = makeDoc({ courseId: null, isCommon: true });
    const csv = documentsToCsv([doc], mockCourses);
    expect(csv).toContain('"Todos os cursos"');
  });

  it('mapeia sem curso e sem isCommon para string vazia', () => {
    const doc = makeDoc({ courseId: null, isCommon: false });
    const csv = documentsToCsv([doc], mockCourses);
    const dataLine = csv.split('\n')[1];
    const cells = dataLine.split(',');
    expect(cells[2]).toBe('""');
  });

  it('mapeia isPublic=true para "Sim"', () => {
    const doc = makeDoc({ isPublic: true });
    expect(documentsToCsv([doc], mockCourses)).toContain('"Sim"');
  });

  it('mapeia isPublic=false para "Nao"', () => {
    const doc = makeDoc({ isPublic: false });
    expect(documentsToCsv([doc], mockCourses)).toContain('"Nao"');
  });

  it('envolve celulas em aspas duplas', () => {
    const doc = makeDoc({ title: 'Simple' });
    const csv = documentsToCsv([doc], mockCourses);
    const dataLine = csv.split('\n')[1];
    expect(dataLine.startsWith('"Simple"')).toBe(true);
  });

  it('preserva virgula dentro do titulo entre as aspas', () => {
    const doc = makeDoc({ title: 'Tem, virgula' });
    const csv = documentsToCsv([doc], mockCourses);
    expect(csv).toContain('"Tem, virgula"');
    expect(csv.split('\n').length).toBe(2);
  });

  it('formata data com toLocaleDateString pt-BR', () => {
    const doc = makeDoc({ uploadedAt: '2026-05-19T10:00:00.000Z' });
    const csv = documentsToCsv([doc], mockCourses);
    expect(csv).toMatch(/"\d{2}\/\d{2}\/\d{4}"/);
  });

  it('gera 1 header + N data rows', () => {
    const docs = [makeDoc({ id: 'a' }), makeDoc({ id: 'b' }), makeDoc({ id: 'c' })];
    const csv = documentsToCsv(docs, mockCourses);
    expect(csv.split('\n').length).toBe(4);
  });
});
