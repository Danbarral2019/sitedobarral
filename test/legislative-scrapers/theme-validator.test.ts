// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { validateThemes, CANONICAL_THEMES } from '../../lib/legislative-scrapers/theme-validator';

describe('validateThemes', () => {
  it('aceita resposta com 1 tema válido', () => {
    const r = validateThemes({ themes: ['contratos'] });
    expect(r.ok).toBe(true);
    expect(r.themes).toEqual(['contratos']);
  });

  it('aceita múltiplos temas válidos', () => {
    const r = validateThemes({ themes: ['planejamento', 'contratos', 'gestao-fiscalizacao'] });
    expect(r.ok).toBe(true);
    expect(r.themes).toEqual(['planejamento', 'contratos', 'gestao-fiscalizacao']);
  });

  it('aceita array vazio (AI decidiu que nenhum tema serve)', () => {
    const r = validateThemes({ themes: [] });
    expect(r.ok).toBe(true);
    expect(r.themes).toEqual([]);
  });

  it('rejeita tema não-canônico', () => {
    const r = validateThemes({ themes: ['tic'] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('unknown theme');
  });

  it('rejeita tema inventado pelo LLM', () => {
    const r = validateThemes({ themes: ['habilitacao-fornecedores'] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('unknown theme');
  });

  it('rejeita mais de 4 temas', () => {
    const r = validateThemes({
      themes: ['contratos', 'planejamento', 'modalidades', 'sancoes', 'sustentabilidade'],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('too many themes');
  });

  it('deduplica preservando ordem', () => {
    const r = validateThemes({ themes: ['contratos', 'planejamento', 'contratos'] });
    expect(r.ok).toBe(true);
    expect(r.themes).toEqual(['contratos', 'planejamento']);
  });

  it('rejeita item não-string no array', () => {
    const r = validateThemes({ themes: ['contratos', 123] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('non-string theme');
  });

  it('rejeita estrutura sem chave themes', () => {
    const r = validateThemes({ categories: ['contratos'] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('missing "themes" array');
  });

  it('rejeita themes que não é array', () => {
    const r = validateThemes({ themes: 'contratos' });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('missing "themes" array');
  });

  it('rejeita null', () => {
    const r = validateThemes(null);
    expect(r.ok).toBe(false);
  });

  it('rejeita string', () => {
    const r = validateThemes('contratos');
    expect(r.ok).toBe(false);
  });

  it('aceita todos os 15 temas canônicos como válidos (spot check)', () => {
    for (const theme of CANONICAL_THEMES) {
      const r = validateThemes({ themes: [theme] });
      expect(r.ok).toBe(true);
      expect(r.themes).toEqual([theme]);
    }
  });
});
