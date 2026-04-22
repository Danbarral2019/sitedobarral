// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { mapFiltersToSemanticOptions } from '../semantic-adapter';

describe('mapFiltersToSemanticOptions — tribunal TCU', () => {
  it('tribunal=TCU: categoryIn TCU, includeTD=false, skipLegActs=true', () => {
    const options = mapFiltersToSemanticOptions({ tribunal: 'TCU' });

    expect(options.categoryIn).toEqual([
      'acordao',
      'consulta_tcu',
      'informativo',
      'manual-tcu',
    ]);
    expect(options.skipDocumentBranch).toBe(false);
    expect(options.skipLegislativeActBranch).toBe(true);
    expect(options.includeTribunalDecisions).toBe(false);
    expect(options.tribunalCodeFilter).toBeUndefined();
  });
});

describe('mapFiltersToSemanticOptions — tribunal TCE/STJ/STF', () => {
  it('tribunal=TCE-SP: skipDocBranch=true, includeTD=true, tribunalCodeFilter=TCE-SP', () => {
    const options = mapFiltersToSemanticOptions({ tribunal: 'TCE-SP' });

    expect(options.skipDocumentBranch).toBe(true);
    expect(options.skipLegislativeActBranch).toBe(true);
    expect(options.includeTribunalDecisions).toBe(true);
    expect(options.tribunalCodeFilter).toBe('TCE-SP');
  });

  it('tribunal=STF: mesmo padrão com tribunalCodeFilter=STF', () => {
    const options = mapFiltersToSemanticOptions({ tribunal: 'STF' });
    expect(options.skipDocumentBranch).toBe(true);
    expect(options.tribunalCodeFilter).toBe('STF');
  });
});

describe('mapFiltersToSemanticOptions — sem filtro de tribunal', () => {
  it('sem filtros: todas categorias TCU + enunciados + TribunalDecisions, legact skipped', () => {
    const options = mapFiltersToSemanticOptions({});

    expect(options.categoryIn).toEqual([
      'acordao',
      'consulta_tcu',
      'informativo',
      'manual-tcu',
      'enunciados',
    ]);
    expect(options.skipDocumentBranch).toBe(false);
    expect(options.skipLegislativeActBranch).toBe(true);
    expect(options.includeTribunalDecisions).toBe(true);
    expect(options.tribunalCodeFilter).toBeUndefined();
  });
});

describe('mapFiltersToSemanticOptions — filtros estruturais via extraWhere', () => {
  it('ano + tribunal=TCU: extraWhere.document tem condição de ano (acordaoAno OR EXTRACT)', () => {
    const options = mapFiltersToSemanticOptions({
      tribunal: 'TCU',
      ano: 2024,
    });

    expect(options.extraWhere?.document).toBeDefined();
    const text = (options.extraWhere!.document as Prisma.Sql).text;
    expect(text).toMatch(/"acordaoAno" = \$/);
    expect(text).toMatch(/EXTRACT\(YEAR FROM "tcuDataJulgamento"\)/);
  });

  it('ano + tribunal=TCE-SP: extraWhere.tribunalDecision tem year = ?', () => {
    const options = mapFiltersToSemanticOptions({
      tribunal: 'TCE-SP',
      ano: 2024,
    });

    expect(options.extraWhere?.tribunalDecision).toBeDefined();
    const text = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(text).toMatch(/year = \$/);
  });

  it('tema + sem tribunal: extraWhere.document E tribunalDecision têm tema', () => {
    const options = mapFiltersToSemanticOptions({ tema: 'pregão' });

    expect(options.extraWhere?.document).toBeDefined();
    expect(options.extraWhere?.tribunalDecision).toBeDefined();
    const docText = (options.extraWhere!.document as Prisma.Sql).text;
    const tdText = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(docText).toMatch(/"tcuArea" ILIKE/);
    expect(tdText).toMatch(/themes ILIKE/);
  });

  it('q é aplicado como hard filter em ambos os ramos', () => {
    const options = mapFiltersToSemanticOptions({ q: 'contrato' });

    const docText = (options.extraWhere!.document as Prisma.Sql).text;
    const tdText = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(docText).toMatch(/title ILIKE/);
    expect(tdText).toMatch(/title ILIKE/);
  });

  it('dataFrom + dataTo: aplicados em ambos os ramos', () => {
    const options = mapFiltersToSemanticOptions({
      dataFrom: new Date('2024-01-01'),
      dataTo: new Date('2024-12-31'),
    });

    const docText = (options.extraWhere!.document as Prisma.Sql).text;
    const tdText = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(docText).toMatch(/"tcuDataJulgamento" >= \$/);
    expect(docText).toMatch(/"tcuDataJulgamento" <= \$/);
    expect(tdText).toMatch(/"dataJulgamento" >= \$/);
    expect(tdText).toMatch(/"dataJulgamento" <= \$/);
  });
});

describe('mapFiltersToSemanticOptions — decisionType', () => {
  it('decisionType=sumula: skipDocumentBranch=true (só TribunalDecision com sumula)', () => {
    const options = mapFiltersToSemanticOptions({ decisionType: 'sumula' });

    expect(options.skipDocumentBranch).toBe(true);
    expect(options.includeTribunalDecisions).toBe(true);
    const tdText = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(tdText).toMatch(/"decisionType" = \$/);
  });

  it('decisionType=acordao: ramo Document permanece ativo', () => {
    const options = mapFiltersToSemanticOptions({ decisionType: 'acordao' });

    expect(options.skipDocumentBranch).toBe(false);
  });
});
