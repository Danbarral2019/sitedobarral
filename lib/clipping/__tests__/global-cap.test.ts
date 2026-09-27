// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { applyGlobalCap } from '../global-cap';
import type { ClippingItem } from '../sources/types';

function item(tribunalCode: string, n: number, relevanceScore: number): ClippingItem {
  return {
    sourceKind: tribunalCode === 'TCU' ? 'document-tcu' : 'tribunal-decision',
    sourceId: `${tribunalCode}-${n}`,
    tribunalCode,
    tribunalName: tribunalCode,
    decisionType: 'acordao',
    decisionNumber: String(n),
    title: `${tribunalCode} ${n}`,
    dataJulgamento: null,
    relator: null,
    orgaoJulgador: null,
    ementa: '',
    fullText: null,
    linkExternal: null,
    linkPdf: null,
    relevanceScore,
    publishedAt: new Date('2026-09-26T00:00:00Z'),
  };
}

function grupo(code: string, qtd: number, score: number): [string, ClippingItem[]] {
  return [code, Array.from({ length: qtd }, (_, i) => item(code, i + 1, score))];
}

const ids = (m: Map<string, ClippingItem[]>) =>
  Object.fromEntries([...m].map(([k, v]) => [k, v.map((i) => i.sourceId)]));

describe('applyGlobalCap', () => {
  it('devolve os grupos intactos quando o total cabe no teto', () => {
    const groups = new Map([grupo('TCU', 2, 20), grupo('STF', 3, 100)]);
    expect(applyGlobalCap(groups, 15)).toBe(groups);
  });

  it('mantém o TCU mesmo com escore numericamente menor que o dos demais', () => {
    const groups = new Map([
      grupo('TCU', 5, 20),
      grupo('TCE-PE', 5, 100),
      grupo('TCDF', 5, 100),
      grupo('STF', 5, 100),
    ]);
    const out = applyGlobalCap(groups, 8);
    expect(ids(out)).toEqual({
      TCU: ['TCU-1', 'TCU-2'],
      'TCE-PE': ['TCE-PE-1', 'TCE-PE-2'],
      TCDF: ['TCDF-1', 'TCDF-2'],
      STF: ['STF-1', 'STF-2'],
    });
  });

  it('dá a sobra da rodada incompleta aos primeiros tribunais da lista', () => {
    const groups = new Map([grupo('TCU', 5, 20), grupo('STJ', 5, 90), grupo('TRF5', 5, 90)]);
    const out = applyGlobalCap(groups, 7);
    expect(ids(out)).toEqual({
      TCU: ['TCU-1', 'TCU-2', 'TCU-3'],
      STJ: ['STJ-1', 'STJ-2'],
      TRF5: ['TRF5-1', 'TRF5-2'],
    });
  });

  it('redistribui as vagas quando um tribunal tem poucos itens', () => {
    const groups = new Map([grupo('TCU', 1, 20), grupo('TJDFT', 5, 90), grupo('TCDF', 5, 90)]);
    const out = applyGlobalCap(groups, 7);
    expect(ids(out)).toEqual({
      TCU: ['TCU-1'],
      TJDFT: ['TJDFT-1', 'TJDFT-2', 'TJDFT-3'],
      TCDF: ['TCDF-1', 'TCDF-2', 'TCDF-3'],
    });
  });
});
