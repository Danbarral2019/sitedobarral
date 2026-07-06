import { describe, it, expect } from 'vitest';
import { detectQueryDomain } from '../domain-detection';

describe('detectQueryDomain — inclusão de jurisprudência', () => {
  it('inclui decisões de tribunais para query com sinal estadual', () => {
    const d = detectQueryDomain('jurisprudência estadual sobre contratos', 'all');
    expect(d.includeTribunalDecisions).toBe(true);
  });

  it('NÃO inclui tribunais para query pura de Lei 14.133', () => {
    const d = detectQueryDomain('prazo para recurso em pregão eletrônico na Lei 14.133', 'all');
    expect(d.includeTribunalDecisions).toBe(false);
    expect(d.tribunalBoost).toBeUndefined();
    expect(d.isStronglyLabor).toBe(false);
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
