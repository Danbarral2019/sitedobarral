// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectLeiArticles,
  classifyDecision,
  generateDecisionSummary,
  promptAmbiguos,
  definirOrcamentoIA,
  orcamentoIARestante,
} from '../classifier';

// Mock do cliente Gemini usado por classifyWithAI/generateDecisionSummary.
const queryGeminiTextMock = vi.fn();
const generateMock = vi.fn();
// Falha simulada fora do vi.fn: o Vitest reporta como erro do teste a
// exceção lançada por um vi.fn, mesmo quando o código sob teste a captura.
let falharGenerate = false;
vi.mock('@/lib/ai', () => ({
  generate: async (...args: unknown[]) => {
    if (falharGenerate) throw new Error('429');
    return generateMock(...args);
  },
}));
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

  it('preserva sufixo de letra (ex: 44-A) sem prefixo', () => {
    // Era "166-A" — artigo que NÃO existe na Lei 14.133, e que a validação de
    // existência passou a descartar. A intenção do teste (ler o sufixo) fica,
    // com um artigo sufixado real.
    expect(detectLeiArticles('conforme o art. 44-A')).toEqual(['44-A']);
  });

  /**
   * O texto de um acórdão cita muitas leis, e a regex não sabe de qual delas é
   * o artigo. Medido em 30/08/2026 no acervo: 114 amarrações apontavam para
   * artigo inexistente na Lei 14.133 — 109 delas do TCE-PE, com números como
   * o art. 966 (ação rescisória, CPC), 884 (enriquecimento sem causa, CC) e
   * 132-D (Lei Orgânica do TCE-PE).
   *
   * A validação por existência não resolve o caso de um "art. 5º do CPC", cujo
   * número também existe na Lei 14.133 — mas elimina, sem heurística, tudo que
   * a lei sequer tem.
   */
  it('descarta artigo que não existe na Lei 14.133 (art. de outro diploma)', () => {
    expect(detectLeiArticles('nos termos do art. 966 do CPC')).toEqual([]);
    expect(detectLeiArticles('art. 132-D da Lei Orgânica do TCE-PE')).toEqual([]);
    expect(detectLeiArticles('violação ao art. 199')).toEqual([]);
  });

  it('mantém os artigos reais quando o texto mistura diplomas', () => {
    expect(detectLeiArticles('o art. 75 da Lei 14.133 e o art. 966 do CPC')).toEqual(['75']);
  });

  it('aceita os arts. 337-E a 337-P, crimes que a Lei 14.133 inseriu no CP', () => {
    expect(detectLeiArticles('art. 337-E')).toEqual(['337-E']);
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
  beforeEach(() => generateMock.mockReset());

  // Decisão de score intermediário (pending, 20-54): 'licitação' (+10 alta),
  // 'fiscalização' (+5 média), 'gestão contratual' (+5 média), 'convênio' (+2 baixa) = 22.
  const pendingDecision = {
    title: 'Análise de licitação',
    ementa: 'Trata de fiscalização e gestão contratual, além de convênio de cooperação. Art. 75 da Lei 14.133.',
  };
  const responde = (o: object) => generateMock.mockResolvedValue({ text: JSON.stringify(o) });

  it('aprova quando a IA diz aprovar, com nota mínima de 55 e artigos locais preservados', async () => {
    const base = await classifyDecision(pendingDecision, false);
    expect(base.approvalStatus).toBe('pending'); // garante que entra no ramo de IA

    responde({ veredito: 'aprovar', nota: 40, motivo: 'fixa tese sobre dispensa', temas: ['contratação direta'] });
    const r = await classifyDecision(pendingDecision, true);
    expect(r.approvalStatus).toBe('auto_approved');
    expect(r.relevanceScore).toBe(55);
    expect(r.leiArticles).toEqual(base.leiArticles);
    expect(r.reasoning).toContain('IA: fixa tese sobre dispensa');
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(generateMock.mock.calls[0][1]).toMatchObject({ provider: 'gemini', temperature: 0, thinkingBudget: 0 });
    // Sem modelo explícito, a lib/ai manda o modelo padrão da tarefa (Claude) ao Gemini: 404.
    expect(generateMock.mock.calls[0][1].model).toMatch(/^gemini-/);
  });

  it('rejeita quando a IA diz rejeitar', async () => {
    responde({ veredito: 'rejeitar', nota: 10, motivo: 'capa de contrato, sem tese', temas: [] });
    const r = await classifyDecision(pendingDecision, true);
    expect(r.approvalStatus).toBe('auto_rejected');
    expect(r.relevanceScore).toBe(10);
  });

  it('mantém pendente quando a IA tem dúvida', async () => {
    responde({ veredito: 'duvida', nota: 50, motivo: 'incerto', temas: [] });
    expect((await classifyDecision(pendingDecision, true)).approvalStatus).toBe('pending');
  });

  it('mantém pendente quando a resposta não é JSON', async () => {
    generateMock.mockResolvedValue({ text: 'não é json' });
    expect((await classifyDecision(pendingDecision, true)).approvalStatus).toBe('pending');
  });

  it('mantém pendente quando o veredito está fora do schema', async () => {
    responde({ veredito: 'talvez', nota: 90, motivo: '', temas: [] });
    expect((await classifyDecision(pendingDecision, true)).approvalStatus).toBe('pending');
  });

  it('mantém pendente quando a chamada à IA falha', async () => {
    falharGenerate = true;
    try {
      expect((await classifyDecision(pendingDecision, true)).approvalStatus).toBe('pending');
    } finally {
      falharGenerate = false;
    }
  });

  it('não chama a IA sem useAI', async () => {
    await classifyDecision(pendingDecision, false);
    expect(generateMock).not.toHaveBeenCalled();
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

describe('promptAmbiguos', () => {
  it('acrescenta o critério de "licitação só como contexto" apenas para tribunais judiciais', () => {
    for (const t of ['STF', 'STJ', 'TRF5', 'TJDF']) expect(promptAmbiguos(t)).toContain('tribunal judicial');
    for (const t of ['TCU', 'TCE-SC', 'TCDF', undefined]) expect(promptAmbiguos(t)).not.toContain('tribunal judicial');
  });
});

describe('classifyDecision — orçamento de IA por execução', () => {
  const pendente = { title: 'Análise de licitação', ementa: 'Trata de fiscalização e gestão contratual, além de convênio de cooperação.' };
  beforeEach(() => {
    generateMock.mockReset();
    generateMock.mockResolvedValue({ text: JSON.stringify({ veredito: 'aprovar', nota: 80, motivo: 'tese', temas: [] }) });
  });

  it('sem orçamento definido, não chama a IA (comportamento de sempre)', async () => {
    definirOrcamentoIA(0);
    expect((await classifyDecision(pendente)).approvalStatus).toBe('pending');
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('consome o orçamento só em pendentes e para quando ele acaba', async () => {
    definirOrcamentoIA(2);
    await classifyDecision({ title: 'x', ementa: 'aposentadoria de servidor' }); // rejeitado por palavra-chave: não gasta
    expect(orcamentoIARestante()).toBe(2);
    expect((await classifyDecision(pendente)).approvalStatus).toBe('auto_approved');
    expect((await classifyDecision(pendente)).approvalStatus).toBe('auto_approved');
    expect((await classifyDecision(pendente)).approvalStatus).toBe('pending');
    expect(generateMock).toHaveBeenCalledTimes(2);
    expect(orcamentoIARestante()).toBe(0);
  });

  it('useAI explícito vence o orçamento', async () => {
    definirOrcamentoIA(5);
    await classifyDecision(pendente, false);
    expect(generateMock).not.toHaveBeenCalled();
    definirOrcamentoIA(0);
  });
});
