// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { detectLeiArticles, classifyDecision } from '../classifier';

describe('detectLeiArticles', () => {
  it('retorna o número puro do artigo, sem o prefixo "Art. " (formato canônico do índice)', () => {
    // O índice LEI_14133_ARTIGOS e os campos leiArticlesArr de Document/
    // LegislativeAct usam número puro ("75"). O classifier precisa gravar no
    // mesmo formato, senão o cruzamento decisão↔artigo quebra.
    expect(detectLeiArticles('nos termos do art. 75 da Lei 14.133')).toEqual(['75']);
  });

  it('preserva sufixo de letra (ex: 166-A) sem prefixo', () => {
    expect(detectLeiArticles('conforme o art. 166-A')).toEqual(['166-A']);
  });

  it('deduplica e ordena numericamente, tudo em número puro', () => {
    expect(detectLeiArticles('art. 75, artigo 6 e novamente Art. 75')).toEqual(['6', '75']);
  });
});

describe('classifyDecision (sem IA — scoring por keywords)', () => {
  it('detecta os artigos da Lei 14.133 citados (número puro)', async () => {
    const r = await classifyDecision({
      title: 'Acórdão',
      ementa: 'Aplica o art. 75 e o art. 6 da Lei 14.133/2021.',
    });
    expect(r.leiArticles).toContain('75');
    expect(r.leiArticles).toContain('6');
  });

  it('dá bônus a processos paradigmáticos (consulta) e registra no reasoning', async () => {
    const r = await classifyDecision({
      title: 'Consulta em tese',
      ementa: 'Firmou entendimento sobre a matéria.',
      decisionType: 'consulta',
    });
    expect(r.reasoning).toMatch(/paradigmatico/i);
    expect(r.relevanceScore).toBeGreaterThan(0);
  });

  it('rejeita automaticamente documento sem sinais de relevância', async () => {
    const r = await classifyDecision({ title: 'xyz', ementa: 'abc' });
    expect(r.approvalStatus).toBe('auto_rejected');
  });

  it('retorna a forma completa e limites válidos do ClassificationResult', async () => {
    const r = await classifyDecision({
      title: 'Acórdão sobre licitação',
      ementa: 'Trata de contrato administrativo e habilitação.',
    });
    expect(r).toMatchObject({
      relevanceScore: expect.any(Number),
      approvalStatus: expect.any(String),
      themes: expect.any(Array),
      leiArticles: expect.any(Array),
      reasoning: expect.any(String),
      suggestedCourses: expect.any(String),
      confidence: expect.any(Number),
    });
    expect(['auto_approved', 'pending', 'auto_rejected']).toContain(r.approvalStatus);
    expect(r.relevanceScore).toBeGreaterThanOrEqual(0);
    expect(r.relevanceScore).toBeLessThanOrEqual(100);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });
});
