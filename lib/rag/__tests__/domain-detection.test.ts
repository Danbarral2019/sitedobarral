import { describe, it, expect } from 'vitest';
import { detectQueryDomain } from '../domain-detection';

describe('detectQueryDomain — inclusão de jurisprudência', () => {
  it('inclui decisões de tribunais para query com sinal estadual', () => {
    const d = detectQueryDomain('jurisprudência estadual sobre contratos', 'all');
    expect(d.includeTribunalDecisions).toBe(true);
  });

  // Este caso afirmava o contrário até 18/08/2026: `includeTribunalDecisions`
  // era `false` para query pura de Lei 14.133. O contrato foi invertido de
  // propósito, com medição — ver o describe "inclusão INCONDICIONAL" abaixo.
  // A parte que continua valendo é a de baixo: pergunta administrativa comum
  // não pode ativar o boost trabalhista.
  it('query pura de Lei 14.133 agora INCLUI tribunais, mas sem sinal trabalhista', () => {
    const d = detectQueryDomain('prazo para recurso em pregão eletrônico na Lei 14.133', 'all');
    expect(d.includeTribunalDecisions).toBe(true);
    expect(d.tribunalBoost).toBeUndefined();
    expect(d.isStronglyLabor).toBe(false);
  });
});

describe('detectQueryDomain — inclusao INCONDICIONAL de decisoes de tribunal', () => {
  // Historico, porque a decisao mudou duas vezes em dois dias e o motivo importa.
  //
  // Ate 08/2026 a inclusao era condicional a padroes de tribunal (TCE, TST).
  // Em 17/08 acrescentei padroes de STF, achando que resolvia -- e o golden
  // set nao conseguia me contradizer, porque nenhuma das 93 queries anotadas
  // tinha decisao de tribunal como resposta certa. A balanca so tinha peso de
  // um lado: incluir decisoes so podia atrapalhar.
  //
  // Com 10 queries de jurisprudencia anotadas (ground truth vindo dos
  // metadados estruturados do STF, nao do ranking), deu para medir os dois
  // lados. O condicional disparava em 1 de 10 perguntas, porque gente pergunta
  // pelo ASSUNTO e nao pelo nome do tribunal:
  //
  //   alternativa            93 antigas   10 novas   103 total
  //   condicional               60,9%        0,0%      51,5%
  //   INCONDICIONAL             57,1%       70,0%      59,1%  <-- escolhida
  //   incondicional + boost      4,2%       86,7%      16,9%  <-- armadilha
  //
  // O boost por tribunal foi medido e descartado: e o melhor para o STF e
  // destroi todo o resto, porque multiplica a similaridade em qualquer
  // pergunta.
  it('inclui decisoes mesmo sem mencao a tribunal nenhum', () => {
    expect(detectQueryDomain('credenciamento pode substituir a licitacao?', 'all').includeTribunalDecisions).toBe(true);
  });

  it('inclui decisoes em pergunta puramente de Lei 14.133', () => {
    expect(detectQueryDomain('prazo de vigencia dos contratos na lei 14133', 'all').includeTribunalDecisions).toBe(true);
  });

  it("respeita o opt-out explicito do scope 'no-tst'", () => {
    expect(detectQueryDomain('qualquer pergunta', 'no-tst').scopedOptions.includeTribunalDecisions).toBe(false);
  });

  it("'tst-only' segue forcando o ramo TST", () => {
    const o = detectQueryDomain('qualquer', 'tst-only').scopedOptions;
    expect(o.includeTribunalDecisions).toBe(true);
    expect(o.tribunalCodeFilter).toBe('TST');
  });

  it('NAO ativa boost trabalhista numa pergunta sobre o Supremo', () => {
    // Regressao: os padroes de STF acrescentados em 17/08 faziam
    // "Supremo Tribunal Federal" casar DUAS vezes, e tribunalMatchCount >= 2
    // ativava isStronglyLabor -> boost do TST numa pergunta do STF.
    const d = detectQueryDomain('jurisprudencia do Supremo Tribunal Federal sobre licitacoes', 'all');
    expect(d.isStronglyLabor).toBe(false);
    expect(d.tribunalBoost).toBeUndefined();
  });

  it('mantem o boost trabalhista quando o sinal e de fato trabalhista', () => {
    const d = detectQueryDomain('responsabilidade subsidiaria do tomador na justica do trabalho', 'all');
    expect(d.tribunalBoost).toEqual({ code: 'TST', factor: 1.2 });
  });
});

describe('detectQueryDomain — boost strong-labor', () => {
  it('sinal institucional (TST) ativa boost factor 1.2', () => {
    const d = detectQueryDomain('o que diz o TST sobre terceirização', 'all');
    expect(d.hasInstitutionalLaborSignal).toBe(true);
    expect(d.isStronglyLabor).toBe(true);
    expect(d.tribunalBoost).toEqual({ code: 'TST', factor: 1.2 });
  });

  it('tier-2 forte isolado (rescisão indireta) ativa strong-labor', () => {
    const d = detectQueryDomain('rescisão indireta por falta de pagamento', 'all');
    expect(d.hasTier2LaborSignal).toBe(true);
    expect(d.isStronglyLabor).toBe(true);
    expect(d.tribunalBoost).toEqual({ code: 'TST', factor: 1.2 });
  });

  it('não ativa strong-labor para query administrativa comum', () => {
    const d = detectQueryDomain('critérios de julgamento por menor preço', 'all');
    expect(d.isStronglyLabor).toBe(false);
  });
});

describe('detectQueryDomain — consciência histórica (súmulas canceladas)', () => {
  it('keyword histórica ativa isHistoricalQuery e inclui canônicos inativos', () => {
    const d = detectQueryDomain('qual era o entendimento antes da reforma trabalhista', 'all');
    expect(d.isHistoricalQuery).toBe(true);
    expect(d.excludeInactiveSumulas).toBe(false);
  });

  it('citação a número de súmula específica ativa isHistoricalQuery', () => {
    const d = detectQueryDomain('o que diz a súmula 331 do TST', 'all');
    expect(d.citesSpecificCanonical).toBe(true);
    expect(d.isHistoricalQuery).toBe(true);
  });

  it('query trabalhista genérica NÃO é histórica (exclui canceladas)', () => {
    const d = detectQueryDomain('responsabilidade subsidiária na terceirização', 'all');
    expect(d.isHistoricalQuery).toBe(false);
    expect(d.excludeInactiveSumulas).toBe(true);
  });
});

describe('detectQueryDomain — scope override', () => {
  it("'tst-only' força ramo TST e pula Document/LegAct/FTS", () => {
    const { scopedOptions } = detectQueryDomain('qualquer pergunta', 'tst-only');
    expect(scopedOptions.includeTribunalDecisions).toBe(true);
    expect(scopedOptions.skipDocumentBranch).toBe(true);
    expect(scopedOptions.skipLegislativeActBranch).toBe(true);
    expect(scopedOptions.tribunalCodeFilter).toBe('TST');
    expect(scopedOptions.skipFts).toBe(true);
    expect(scopedOptions.tribunalBoost).toBeUndefined();
  });

  it("'no-tst' descarta ramo TST e boost mesmo em query trabalhista", () => {
    const { scopedOptions, isStronglyLabor } = detectQueryDomain('rescisão indireta', 'no-tst');
    expect(isStronglyLabor).toBe(true); // a flag continua verdadeira...
    expect(scopedOptions.includeTribunalDecisions).toBe(false); // ...mas o scope sobrepõe
    expect(scopedOptions.tribunalBoost).toBeUndefined();
    expect(scopedOptions.skipFts).toBe(false);
  });

  it("'all' usa o resultado do detector", () => {
    const { scopedOptions } = detectQueryDomain('o que diz o TST sobre terceirização', 'all');
    expect(scopedOptions.includeTribunalDecisions).toBe(true);
    expect(scopedOptions.tribunalBoost).toEqual({ code: 'TST', factor: 1.2 });
  });
});
