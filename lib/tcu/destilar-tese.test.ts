import { describe, it, expect } from 'vitest';
import { montarPromptTese, parseRespostaTese } from './destilar-tese';
import type { CasoDestilacao } from './destilar-tese';

const caso: CasoDestilacao = {
  chave: '1441/2016',
  ementaPropria: 'Incidente de Uniformização de Jurisprudência. Prazo prescricional.',
  colegiado: 'Plenário',
  relator: 'Benjamin Zymler',
  dossie: {
    alvo: { numero: 1441, ano: 2016 },
    contagem: { citantesDistintos: 80, noVoto: 80, ocorrenciasTotal: 120 },
    trechos: [
      { origemChave: '2/2021', secao: 'voto', noVoto: true, trecho: 'Conforme o Acórdão 1441/2016, o prazo é de cinco anos.', offset: 0 },
    ],
  },
};

describe('montarPromptTese', () => {
  it('inclui a ementa própria, os trechos e a instrução conservadora', () => {
    const { systemPrompt, userContent } = montarPromptTese(caso);
    expect(systemPrompt).toMatch(/tese|ratio|precedente/i);
    expect(systemPrompt).toMatch(/n[ãa]o inven|sem apoio|conservador/i); // anti-alucinação
    expect(userContent).toContain('1441/2016');
    expect(userContent).toContain('Prazo prescricional'); // ementa própria
    expect(userContent).toContain('o prazo é de cinco anos'); // trecho de uso
    expect(userContent).toContain('[0]'); // trechos numerados p/ trechosFonte
  });
});

describe('parseRespostaTese', () => {
  it('parseia JSON válido e preenche defaults', () => {
    const text = JSON.stringify({
      assunto: 'Prescrição',
      teses: [{ enunciado: 'Prazo de 5 anos.', inovacao: 'Uniformizou o prazo.', trechosFonte: [0] }],
      sinaisQualitativos: [],
      divergencias: [],
      confianca: 'alta',
    });
    const t = parseRespostaTese('1441/2016', text);
    expect(t.chave).toBe('1441/2016');
    expect(t.assunto).toBe('Prescrição');
    expect(t.teses[0].enunciado).toBe('Prazo de 5 anos.');
    expect(t.confianca).toBe('alta');
  });

  it('tolera cerca de código ```json e campos ausentes', () => {
    const text = '```json\n{"assunto":"X","teses":[]}\n```';
    const t = parseRespostaTese('9/2020', text);
    expect(t.assunto).toBe('X');
    expect(t.teses).toEqual([]);
    expect(t.sinaisQualitativos).toEqual([]);
    expect(t.divergencias).toEqual([]);
    expect(t.confianca).toBe('baixa'); // default quando ausente
  });

  it('lança em JSON irrecuperável', () => {
    expect(() => parseRespostaTese('9/2020', 'desculpe, não consigo')).toThrow();
  });
});
