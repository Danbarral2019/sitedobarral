/**
 * Testes para lib/admin/tcu-manager/helpers.ts
 */

import { describe, it, expect, vi } from 'vitest';
import {
  courseIdsToSlugs,
  buildValidationExcelData,
  mapValidationToImport,
} from '../helpers';

// Mock minimo de courses pra cover testes de courseIdsToSlugs
vi.mock('@/data/courses', () => ({
  courses: [
    { id: '1', slug: 'nova-lei-licitacoes' },
    { id: '2', slug: 'planejamento-contratacoes' },
    { id: '3', slug: 'gestao-fiscalizacao' },
  ],
}));

describe('courseIdsToSlugs', () => {
  it('converte array de IDs em string de slugs CSV', () => {
    expect(courseIdsToSlugs(['1', '2'])).toBe('nova-lei-licitacoes,planejamento-contratacoes');
  });

  it('ignora IDs nao encontrados', () => {
    expect(courseIdsToSlugs(['1', '99'])).toBe('nova-lei-licitacoes');
  });

  it('retorna string vazia para array vazio', () => {
    expect(courseIdsToSlugs([])).toBe('');
  });

  it('retorna string vazia quando nenhum match', () => {
    expect(courseIdsToSlugs(['100', '200'])).toBe('');
  });
});

describe('buildValidationExcelData', () => {
  const baseDoc = {
    title: 'Acordao X',
    description: 'Sobre X',
    category: 'acordao',
    isValid: true,
    isDuplicate: false,
    errors: [],
    warnings: [],
    rowIndex: 0,
    rawData: {},
  };

  it('mapeia doc valido nao-duplicado para "VALIDO"', () => {
    const rows = buildValidationExcelData([{ ...baseDoc }]);
    expect(rows[0].Status).toContain('VÁLIDO');
  });

  it('mapeia doc duplicado para "DUPLICATA"', () => {
    const rows = buildValidationExcelData([{ ...baseDoc, isDuplicate: true }]);
    expect(rows[0].Status).toContain('DUPLICATA');
  });

  it('mapeia doc invalido para "INVALIDO"', () => {
    const rows = buildValidationExcelData([{ ...baseDoc, isValid: false }]);
    expect(rows[0].Status).toContain('INVÁLIDO');
  });

  it('indexa linhas comecando em 1', () => {
    const rows = buildValidationExcelData([baseDoc, baseDoc, baseDoc]);
    expect(rows[0]['#']).toBe(1);
    expect(rows[2]['#']).toBe(3);
  });

  it('usa rawData como fallback quando title vazio', () => {
    const rows = buildValidationExcelData([
      { ...baseDoc, title: '', rawData: { Titulo: 'From Raw' } },
    ]);
    expect(rows[0].Titulo).toBe('From Raw');
  });

  it('combina errors + warnings em coluna Avisos', () => {
    const rows = buildValidationExcelData([
      { ...baseDoc, errors: ['err1'], warnings: ['warn1', 'warn2'] },
    ]);
    expect(rows[0].Avisos).toBe('err1; warn1; warn2');
  });
});

describe('mapValidationToImport', () => {
  it('mapeia somente docs validos', () => {
    const docs = [
      {
        title: 'A', description: 'desc A', category: 'acordao', isValid: true, isDuplicate: false,
        errors: [], warnings: [], rowIndex: 0, rawData: {},
      },
      {
        title: 'B', description: 'desc B', category: 'acordao', isValid: false, isDuplicate: false,
        errors: [], warnings: [], rowIndex: 1, rawData: {},
      },
    ];
    const result = mapValidationToImport(docs);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });

  it('preserva flag isDuplicate', () => {
    const docs = [
      {
        title: 'A', description: '', category: 'acordao', isValid: true, isDuplicate: true,
        errors: [], warnings: [], rowIndex: 0, rawData: {},
      },
    ];
    expect(mapValidationToImport(docs)[0].isDuplicate).toBe(true);
  });

  it('usa rawData como fallback pra campos vazios', () => {
    const docs = [
      {
        title: '', description: '', category: '', isValid: true, isDuplicate: false,
        errors: [], warnings: [], rowIndex: 0,
        rawData: { Titulo: 'Raw Title', Categoria: 'parecer', URL: 'http://x' },
      },
    ];
    const r = mapValidationToImport(docs)[0];
    expect(r.title).toBe('Raw Title');
    expect(r.category).toBe('parecer');
    expect(r.url).toBe('http://x');
  });

  it('default publico=SIM e category=acordao', () => {
    const docs = [
      {
        title: 'X', description: '', category: '', isValid: true, isDuplicate: false,
        errors: [], warnings: [], rowIndex: 0, rawData: {},
      },
    ];
    const r = mapValidationToImport(docs)[0];
    expect(r.publico).toBe('SIM');
    expect(r.category).toBe('acordao');
  });
});
