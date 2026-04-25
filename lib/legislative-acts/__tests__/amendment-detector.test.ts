// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { detectAmendments } from '../amendment-detector';

describe('detectAmendments', () => {
  it('detecta REVOGA de Lei explícita', () => {
    const result = detectAmendments('Revoga a Lei nº 8.666, de 21 de junho de 1993.', '');
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'revoga',
      targetFullNumber: 'Lei 8.666/1993',
    }));
  });

  it('detecta REVOGA de Decreto', () => {
    const result = detectAmendments('Revoga o Decreto nº 7.892/2013.', '');
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'revoga',
      targetFullNumber: 'Decreto 7.892/2013',
    }));
  });

  it('detecta ALTERA com nova redação', () => {
    const result = detectAmendments(
      'Dá nova redação ao art. 75 da Lei nº 14.133, de 1º de abril de 2021.',
      ''
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'altera',
      targetFullNumber: 'Lei 14.133/2021',
      excerpt: expect.stringContaining('art. 75'),
    }));
  });

  it('detecta REGULAMENTA artigo da Lei 14.133', () => {
    const result = detectAmendments(
      'Regulamenta o art. 8º da Lei nº 14.133, de 1º de abril de 2021.',
      ''
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'regulamenta',
      targetFullNumber: 'Lei 14.133/2021',
    }));
  });

  it('detecta ACRESCE artigo (vira ALTERA)', () => {
    const result = detectAmendments(
      'Acresce o art. 12-A à Lei nº 12.456, de 4 de maio de 2011.',
      ''
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'altera',
      targetFullNumber: 'Lei 12.456/2011',
    }));
  });

  it('detecta IN com formato SEGES/MGI', () => {
    const result = detectAmendments(
      'Altera a Instrução Normativa SEGES/MGI nº 5/2017.',
      ''
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'altera',
      targetFullNumber: expect.stringMatching(/IN.*5\/2017/),
    }));
  });

  it('extrai múltiplas relações da mesma ementa', () => {
    const result = detectAmendments(
      'Altera a Lei nº 14.133/2021 e revoga o Decreto nº 7.892/2013.',
      ''
    );
    expect(result).toHaveLength(2);
    expect(result.find(r => r.relationType === 'altera')?.targetFullNumber).toBe('Lei 14.133/2021');
    expect(result.find(r => r.relationType === 'revoga')?.targetFullNumber).toBe('Decreto 7.892/2013');
  });

  it('deduplica relações idênticas (mesmo target+type)', () => {
    const result = detectAmendments(
      'Altera a Lei nº 14.133/2021. Esta IN também altera a Lei nº 14.133/2021 em outros pontos.',
      ''
    );
    const altera14133 = result.filter(r => r.relationType === 'altera' && r.targetFullNumber === 'Lei 14.133/2021');
    expect(altera14133).toHaveLength(1);
  });

  it('detecta no content quando ementa não tem', () => {
    const result = detectAmendments(
      'Dispõe sobre fiscalização de contratos.',
      'Considerando o disposto na Lei nº 14.133, de 1º de abril de 2021, especialmente o art. 117, esta IN regulamenta...'
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'regulamenta',
      targetFullNumber: 'Lei 14.133/2021',
    }));
  });

  it('confidence é 0.7-0.9 pra heurística', () => {
    const result = detectAmendments('Revoga a Lei nº 8.666/93.', '');
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.7);
    expect(result[0].confidence).toBeLessThanOrEqual(0.9);
  });

  it('retorna [] pra ementa sem indicadores', () => {
    const result = detectAmendments('Designa o servidor João Silva.', '');
    expect(result).toEqual([]);
  });

  it('normaliza ano de 2 dígitos pra 4 dígitos (93 → 1993)', () => {
    const result = detectAmendments('Revoga a Lei nº 8.666/93.', '');
    expect(result[0].targetFullNumber).toBe('Lei 8.666/1993');
  });

  it('inclui excerpt com contexto da menção', () => {
    const result = detectAmendments(
      'Esta portaria altera profundamente a Lei nº 14.133/2021 em vários dispositivos.',
      ''
    );
    expect(result[0].excerpt).toContain('Lei nº 14.133/2021');
    expect(result[0].excerpt.length).toBeLessThanOrEqual(200);
  });
});
