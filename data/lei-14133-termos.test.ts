import { describe, it, expect } from 'vitest';
import { TERMOS_POR_ARTIGO } from './lei-14133-termos';
import { LEI_14133_ARTIGOS } from './lei-14133-artigos';

describe('TERMOS_POR_ARTIGO', () => {
  it('o art. 5º tem os 22 princípios', () => {
    expect(TERMOS_POR_ARTIGO['5']).toHaveLength(22);
  });

  it('inclui os princípios que o caput nomeia', () => {
    const t = TERMOS_POR_ARTIGO['5'];
    for (const p of ['legalidade', 'economicidade', 'julgamento objetivo', 'desenvolvimento nacional sustentável']) {
      expect(t).toContain(p);
    }
  });

  it('todo artigo mapeado existe na Lei', () => {
    for (const num of Object.keys(TERMOS_POR_ARTIGO)) {
      expect(LEI_14133_ARTIGOS).toHaveProperty(num);
    }
  });

  it('termos são minúsculos e sem duplicata (a busca é case-insensitive)', () => {
    for (const termos of Object.values(TERMOS_POR_ARTIGO)) {
      for (const t of termos) expect(t).toBe(t.toLowerCase());
      expect(new Set(termos).size).toBe(termos.length);
    }
  });
});
