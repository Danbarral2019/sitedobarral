// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { classifyByHeuristic } from '../../lib/legislative-scrapers/theme-enricher';

function act(overrides: Partial<Parameters<typeof classifyByHeuristic>[0]> = {}): Parameters<typeof classifyByHeuristic>[0] {
  return {
    fullNumber: 'Test 1/2024',
    title: null,
    ementa: null,
    leiArticles: null,
    content: null,
    ...overrides,
  };
}

describe('classifyByHeuristic', () => {
  describe('mapeamento de artigos', () => {
    it('artigo 18 → planejamento', () => {
      expect(classifyByHeuristic(act({ leiArticles: '["18"]' }))).toContain('planejamento');
    });

    it('artigo 23 → planejamento e pesquisa-precos (aparece em ambos)', () => {
      const themes = classifyByHeuristic(act({ leiArticles: '["23"]' }));
      expect(themes).toContain('planejamento');
      expect(themes).toContain('pesquisa-precos');
    });

    it('artigo 89 → contratos', () => {
      expect(classifyByHeuristic(act({ leiArticles: '["89"]' }))).toContain('contratos');
    });

    it('artigo 155 → sancoes', () => {
      expect(classifyByHeuristic(act({ leiArticles: '["155"]' }))).toContain('sancoes');
    });

    it('múltiplos artigos retornam todos os temas aplicáveis', () => {
      const themes = classifyByHeuristic(act({ leiArticles: '["18","89","155"]' }));
      expect(themes).toEqual(expect.arrayContaining(['planejamento', 'contratos', 'sancoes']));
    });

    it('artigo não mapeado (ex: 191) retorna [] (do lado articles)', () => {
      expect(classifyByHeuristic(act({ leiArticles: '["191"]' }))).toEqual([]);
    });

    it('leiArticles malformado → ignora, retorna []', () => {
      expect(classifyByHeuristic(act({ leiArticles: 'not-json' }))).toEqual([]);
    });

    it('leiArticles null → retorna []', () => {
      expect(classifyByHeuristic(act({ leiArticles: null }))).toEqual([]);
    });
  });

  describe('keyword matching', () => {
    it('"pregão eletrônico" no título → pregao-eletronico', () => {
      expect(
        classifyByHeuristic(act({ title: 'Regulamenta o pregão eletrônico' }))
      ).toContain('pregao-eletronico');
    });

    it('"termo de referencia" na ementa → planejamento', () => {
      expect(
        classifyByHeuristic(act({ ementa: 'Dispõe sobre o Termo de Referência para TIC' }))
      ).toContain('planejamento');
    });

    it('keyword é case-insensitive e tolerante a acentos', () => {
      expect(
        classifyByHeuristic(act({ title: 'INEXIGIBILIDADE e Dispensa' }))
      ).toContain('contratacao-direta');
    });

    it('sem keyword match → retorna []', () => {
      expect(
        classifyByHeuristic(act({ title: 'Regulamenta assunto genérico', ementa: 'sem correspondência' }))
      ).toEqual([]);
    });
  });

  describe('combinação articles + keywords', () => {
    it('inclui temas de ambas as fontes sem duplicar', () => {
      const themes = classifyByHeuristic(
        act({
          leiArticles: '["89"]',
          title: 'Regulamenta pregão eletrônico',
          ementa: 'relativo a contratos administrativos',
        })
      );
      expect(themes).toContain('contratos');        // via articles E keywords — sem duplicar
      expect(themes).toContain('pregao-eletronico'); // via keywords
      const contratosCount = themes.filter((t) => t === 'contratos').length;
      expect(contratosCount).toBe(1);
    });

    it('preserva ordem de inserção (articles primeiro, keywords depois)', () => {
      const themes = classifyByHeuristic(
        act({
          leiArticles: '["18"]',               // planejamento
          title: 'Regulamenta obras e engenharia', // obras-engenharia
        })
      );
      expect(themes.indexOf('planejamento')).toBeLessThan(themes.indexOf('obras-engenharia'));
    });
  });
});
