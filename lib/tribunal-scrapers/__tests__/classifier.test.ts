// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectLeiArticles,
  classifyDecision,
  generateDecisionSummary,
} from '../classifier';

// Mock do cliente Gemini usado por classifyWithAI/generateDecisionSummary.
const queryGeminiTextMock = vi.fn();
vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: unknown[]) => queryGeminiTextMock(...args),
}));

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

  it('registra as faixas de keyword moderate/medium/low/exclude no reasoning', async () => {
    const r = await classifyDecision({
      title: 'Decisão',
      // 'divergência' = paradigmático moderado (+8); 'fiscalização' = média (+5);
      // 'convênio' = baixa (+2); 'criminal' = exclusão (-15).
      ementa: 'Há divergência quanto à fiscalização de convênio em matéria criminal.',
    });
    expect(r.reasoning).toContain('paradigmatico moderado');
    expect(r.reasoning).toContain('media relevancia');
    expect(r.reasoning).toContain('baixa relevancia');
    expect(r.reasoning).toContain('exclusao');
  });

  it('auto-rejeita quando o score é fortemente negativo (só exclusões)', async () => {
    const r = await classifyDecision({
      title: 'Processo criminal',
      ementa: 'Trata de homicídio, roubo e furto — matéria penal.',
    });
    expect(r.approvalStatus).toBe('auto_rejected');
  });
});

describe('classifyDecision — caminho de IA (pending + useAI)', () => {
  beforeEach(() => queryGeminiTextMock.mockReset());

  // Decisão de score intermediário (pending, 20-54): 'licitação' (+10 alta),
  // 'fiscalização' (+5 média), 'gestão contratual' (+5 média), 'convênio' (+2 baixa) = 22.
  const pendingDecision = {
    title: 'Análise de licitação',
    ementa: 'Trata de fiscalização e gestão contratual, além de convênio de cooperação.',
  };

  it('usa o resultado da IA e preserva leiArticles/suggestedCourses locais', async () => {
    const base = await classifyDecision(pendingDecision, false);
    expect(base.approvalStatus).toBe('pending'); // garante que entra no ramo de IA

    queryGeminiTextMock.mockResolvedValue({
      response: JSON.stringify({
        relevanceScore: 88,
        approvalStatus: 'auto_approved',
        themes: ['tema-ia'],
        reasoning: 'relevante segundo IA',
        confidence: 90,
      }),
    });

    const r = await classifyDecision(pendingDecision, true);
    expect(r.approvalStatus).toBe('auto_approved');
    expect(r.relevanceScore).toBe(88);
    expect(queryGeminiTextMock).toHaveBeenCalledTimes(1);
  });

  it('cai para o score por keyword quando o JSON da IA é inválido', async () => {
    queryGeminiTextMock.mockResolvedValue({ response: 'não é json' });
    const r = await classifyDecision(pendingDecision, true);
    // classifyWithAI devolve null no parse-fail; classifyDecision mantém o pending
    expect(r.approvalStatus).toBe('pending');
  });

});

describe('generateDecisionSummary', () => {
  beforeEach(() => queryGeminiTextMock.mockReset());

  const longText = 'A'.repeat(150);

  it('retorna null quando o texto é muito curto (< 100 chars)', async () => {
    const out = await generateDecisionSummary({ title: 'X', ementa: 'curto' });
    expect(out).toBeNull();
    expect(queryGeminiTextMock).not.toHaveBeenCalled();
  });

  it('retorna o resumo saneado da IA', async () => {
    queryGeminiTextMock.mockResolvedValue({
      response: '  Esta decisão trata de licitação e fixa tese sobre contratação direta.  ',
    });
    const out = await generateDecisionSummary({ title: 'Acórdão', ementa: longText });
    expect(out).toBe('Esta decisão trata de licitação e fixa tese sobre contratação direta.');
  });

  it('rejeita resumo curto demais ou que pareça JSON', async () => {
    queryGeminiTextMock.mockResolvedValue({ response: 'curto' });
    expect(await generateDecisionSummary({ title: 'A', ementa: longText })).toBeNull();
    queryGeminiTextMock.mockResolvedValue({ response: '{"erro":"algo"}' });
    expect(await generateDecisionSummary({ title: 'A', ementa: longText })).toBeNull();
  });

  it('retorna null quando a resposta da IA é malformada (cai no catch)', async () => {
    // response ausente → result.response.trim() lança TypeError, exercitando
    // o bloco catch de tratamento de erro.
    queryGeminiTextMock.mockResolvedValue({});
    expect(await generateDecisionSummary({ title: 'A', ementa: longText })).toBeNull();
  });
});
