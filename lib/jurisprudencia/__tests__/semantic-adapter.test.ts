// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  mapFiltersToSemanticOptions,
  resolveEmenta,
  resolveFullText,
} from '../semantic-adapter';

const { mockDocumentFindMany, mockTribunalDecisionFindMany } = vi.hoisted(() => ({
  mockDocumentFindMany: vi.fn(),
  mockTribunalDecisionFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...args: any[]) => mockDocumentFindMany(...args) },
    tribunalDecision: { findMany: (...args: any[]) => mockTribunalDecisionFindMany(...args) },
  },
}));

beforeEach(() => {
  mockDocumentFindMany.mockReset();
  mockTribunalDecisionFindMany.mockReset();
});

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

describe('enrichSources', () => {
  const makeDocResult = (id: string, category: string) => ({
    documentId: id,
    documentTitle: `Title ${id}`,
    category,
    chunkContent: `chunk ${id}`,
    chunkIndex: 0,
    similarity: 0.8,
    url: `http://x/${id}`,
    courseId: undefined,
    isCommon: true,
    tags: undefined,
    leiArticles: null,
    uploadedAt: '2024-01-01',
    sourceType: 'document' as const,
  });

  const makeTdResult = (id: string) => ({
    documentId: id,
    documentTitle: `TD ${id}`,
    category: 'acordao',
    chunkContent: `chunk ${id}`,
    chunkIndex: 0,
    similarity: 0.75,
    url: undefined,
    courseId: undefined,
    isCommon: true,
    tags: undefined,
    leiArticles: null,
    uploadedAt: '2024-01-01',
    sourceType: 'tribunal-decision' as const,
  });

  it('quando só há documents: chama só document.findMany', async () => {
    const { enrichSources } = await import('../semantic-adapter');
    mockDocumentFindMany.mockResolvedValueOnce([
      {
        id: 'doc-1',
        title: 'Doc 1',
        category: 'acordao',
        tcuNumeroAcordao: 'AC-1/24',
        tcuEmentaCompleta: 'ementa',
        description: null,
        content: null,
        tcuRelator: 'Rel',
        tcuAutorTese: null,
        tcuOrgaoJulgador: 'Plenário',
        tcuDataJulgamento: new Date('2024-05-01'),
        tcuLinkPDF: null,
        summary: null,
        themes: null,
        leiArticlesArr: [],
        url: null,
        douData: null,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        entityType: null,
        enunciadoNumber: null,
      },
    ]);

    const results = [makeDocResult('doc-1', 'acordao')];
    const enriched = await enrichSources(results);

    expect(enriched).toHaveLength(1);
    expect(mockDocumentFindMany).toHaveBeenCalledTimes(1);
    expect(mockTribunalDecisionFindMany).not.toHaveBeenCalled();
    expect(enriched[0]).toMatchObject({
      documentId: 'doc-1',
      similarity: 0.8,
      chunkContent: 'chunk doc-1',
      source: { kind: 'document', category: 'acordao' },
    });
  });

  it('quando só há tribunal-decisions: chama só tribunalDecision.findMany', async () => {
    const { enrichSources } = await import('../semantic-adapter');
    mockTribunalDecisionFindMany.mockResolvedValueOnce([
      {
        id: 'td-1',
        tribunalCode: 'TCE-SP',
        tribunalName: 'TCE-SP',
        decisionType: 'acordao',
        decisionNumber: '1234/2024',
        title: 'TD 1',
        ementa: 'ementa td',
        fullText: null,
        summary: null,
        relator: 'Rel TD',
        orgaoJulgador: 'Pleno',
        dataJulgamento: new Date('2024-06-01'),
        themes: null,
        leiArticlesArr: [],
        url: null,
      },
    ]);

    const results = [makeTdResult('td-1')];
    const enriched = await enrichSources(results);

    expect(enriched).toHaveLength(1);
    expect(mockDocumentFindMany).not.toHaveBeenCalled();
    expect(mockTribunalDecisionFindMany).toHaveBeenCalledTimes(1);
    expect(enriched[0].source.kind).toBe('tribunal-decision');
  });

  it('resultado órfão (chunk → doc deletado): skip silencioso', async () => {
    const { enrichSources } = await import('../semantic-adapter');
    mockDocumentFindMany.mockResolvedValueOnce([]); // sem match

    const results = [makeDocResult('doc-orphan', 'acordao')];
    const enriched = await enrichSources(results);

    expect(enriched).toHaveLength(0);
  });

  it('múltiplos tipos: 1 query por tipo em paralelo', async () => {
    const { enrichSources } = await import('../semantic-adapter');
    mockDocumentFindMany.mockResolvedValueOnce([
      { id: 'doc-1', title: 'D', category: 'informativo', tcuNumeroAcordao: null,
        tcuEmentaCompleta: null, description: 'desc', content: null, tcuRelator: null,
        tcuAutorTese: null, tcuOrgaoJulgador: null, tcuDataJulgamento: null, tcuLinkPDF: null,
        summary: null, themes: null, leiArticlesArr: [], url: null, douData: null,
        uploadedAt: new Date(), updatedAt: new Date(), entityType: null, enunciadoNumber: null },
    ]);
    mockTribunalDecisionFindMany.mockResolvedValueOnce([
      { id: 'td-1', tribunalCode: 'STJ', tribunalName: 'STJ', decisionType: 'decisao',
        decisionNumber: '9/24', title: 'T', ementa: 'e', fullText: null, summary: null, relator: null,
        orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null },
    ]);

    const results = [makeDocResult('doc-1', 'informativo'), makeTdResult('td-1')];
    const enriched = await enrichSources(results);

    expect(enriched).toHaveLength(2);
    expect(enriched.find(e => e.documentId === 'doc-1')?.source.kind).toBe('document');
    expect(enriched.find(e => e.documentId === 'td-1')?.source.kind).toBe('tribunal-decision');
  });
});

describe('adaptToSourcesPayload — TribunalDecision', () => {
  it('mapeia campos diretos', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'td-1',
        similarity: 0.85,
        chunkContent: 'trecho',
        source: {
          kind: 'tribunal-decision' as const,
          data: {
            id: 'td-1',
            tribunalCode: 'TCE-SP',
            tribunalName: 'Tribunal de Contas do Estado de São Paulo',
            decisionType: 'acordao',
            decisionNumber: '1234/2024',
            title: 'Acórdão TCE-SP',
            ementa: 'Ementa completa',
            fullText: null,
            summary: null,
            relator: 'Ministro X',
            orgaoJulgador: 'Plenário',
            dataJulgamento: new Date('2024-05-01'),
            themes: '["tema1"]',
            leiArticlesArr: ['75'],
            url: 'http://x',
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual({
      id: 'td-1',
      tribunalCode: 'TCE-SP',
      tribunalName: 'Tribunal de Contas do Estado de São Paulo',
      decisionType: 'acordao',
      decisionNumber: '1234/2024',
      title: 'Acórdão TCE-SP',
      relator: 'Ministro X',
      orgaoJulgador: 'Plenário',
      dataJulgamento: new Date('2024-05-01'),
      url: 'http://x',
      sourceType: 'tribunal-decision',
      similarity: 0.85,
    });
  });
});

describe('adaptToSourcesPayload — Document acordao/consulta_tcu', () => {
  it('acordao TCU: tribunalCode=TCU, decisionType=acordao, relator com fallback', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'doc-1',
        similarity: 0.82,
        chunkContent: 'tr',
        source: {
          kind: 'document' as const,
          category: 'acordao',
          data: {
            id: 'doc-1',
            title: 'Acórdão',
            category: 'acordao',
            tcuNumeroAcordao: 'AC-1106/24-P',
            tcuEmentaCompleta: 'ementa',
            description: null,
            content: null,
            tcuRelator: null,
            tcuAutorTese: 'MIN AUGUSTO',
            tcuOrgaoJulgador: 'Plenário',
            tcuDataJulgamento: new Date('2024-05-20'),
            tcuLinkPDF: 'http://tcu.pdf',
            summary: null,
            themes: null,
            leiArticlesArr: [],
            url: 'http://tcu.ac/1106',
            douData: null,
            uploadedAt: new Date(),
            updatedAt: new Date(),
            entityType: null,
            enunciadoNumber: null,
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload[0]).toMatchObject({
      tribunalCode: 'TCU',
      tribunalName: 'Tribunal de Contas da União',
      decisionType: 'acordao',
      decisionNumber: 'AC-1106/24-P',
      relator: 'MIN AUGUSTO', // fallback tcuAutorTese
      orgaoJulgador: 'Plenário',
      sourceType: 'document-tcu-acordao',
    });
  });
});

describe('adaptToSourcesPayload — informativo', () => {
  it('informativo: decisionType=informativo, decisionNumber derivado do title', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'inf-1',
        similarity: 0.88,
        chunkContent: 't',
        source: {
          kind: 'document' as const,
          category: 'informativo',
          data: {
            id: 'inf-1',
            title: 'Informativo LC nº 42',
            category: 'informativo',
            tcuNumeroAcordao: null,
            tcuEmentaCompleta: null,
            description: 'resumo',
            content: null,
            tcuRelator: null,
            tcuAutorTese: null,
            tcuOrgaoJulgador: null,
            tcuDataJulgamento: null,
            tcuLinkPDF: null,
            summary: null,
            themes: null,
            leiArticlesArr: [],
            url: null,
            douData: new Date('2024-01-15'),
            uploadedAt: new Date('2024-02-01'),
            updatedAt: new Date(),
            entityType: null,
            enunciadoNumber: null,
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload[0]).toMatchObject({
      tribunalCode: 'TCU',
      decisionType: 'informativo',
      decisionNumber: 'Informativo LC nº 42',
      relator: null,
      dataJulgamento: new Date('2024-01-15'), // prefere douData
      sourceType: 'document-tcu-informativo',
    });
  });

  it('informativo com título contendo acentos: regex casa corretamente', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const makeInformativoEnriched = (title: string) => [{
      documentId: 'inf-acc',
      similarity: 0.8,
      chunkContent: 't',
      source: {
        kind: 'document' as const,
        category: 'informativo',
        data: {
          id: 'inf-acc',
          title,
          category: 'informativo',
          tcuNumeroAcordao: null, tcuEmentaCompleta: null, description: null,
          content: null, tcuRelator: null, tcuAutorTese: null, tcuOrgaoJulgador: null,
          tcuDataJulgamento: null, tcuLinkPDF: null, summary: null, themes: null,
          leiArticlesArr: [], url: null, douData: null,
          uploadedAt: new Date(), updatedAt: new Date(),
          entityType: null, enunciadoNumber: null,
        },
      },
    }];

    // Padrão oficial TCU com acentos ("Licitações")
    const p1 = adaptToSourcesPayload(makeInformativoEnriched('Informativo de Licitações e Contratos 42'));
    expect(p1[0].decisionNumber).toBe('Informativo de Licitações e Contratos 42');

    // Com ano após barra
    const p2 = adaptToSourcesPayload(makeInformativoEnriched('Informativo Especial nº 1/2024'));
    expect(p2[0].decisionNumber).toBe('Informativo Especial nº 1/2024');
  });
});

describe('adaptToSourcesPayload — manual-tcu', () => {
  it('manual: decisionType=manual, decisionNumber=title', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'man-1',
        similarity: 0.7,
        chunkContent: 't',
        source: {
          kind: 'document' as const,
          category: 'manual-tcu',
          data: {
            id: 'man-1',
            title: 'Manual de Auditoria TCU 2023',
            category: 'manual-tcu',
            tcuNumeroAcordao: null, tcuEmentaCompleta: null, description: null, content: null,
            tcuRelator: null, tcuAutorTese: null, tcuOrgaoJulgador: null,
            tcuDataJulgamento: null, tcuLinkPDF: null, summary: null, themes: null,
            leiArticlesArr: [], url: null, douData: null,
            uploadedAt: new Date('2023-01-01'), updatedAt: new Date(),
            entityType: null, enunciadoNumber: null,
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload[0]).toMatchObject({
      tribunalCode: 'TCU',
      decisionType: 'manual',
      decisionNumber: 'Manual de Auditoria TCU 2023',
      sourceType: 'document-tcu-manual',
    });
  });
});

describe('adaptToSourcesPayload — enunciados', () => {
  it('enunciado: tribunalCode do entityType, decisionNumber=enunciadoNumber', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'en-1',
        similarity: 0.75,
        chunkContent: 't',
        source: {
          kind: 'document' as const,
          category: 'enunciados',
          data: {
            id: 'en-1',
            title: 'Enunciado IBDA nº 10',
            category: 'enunciados',
            tcuNumeroAcordao: null, tcuEmentaCompleta: null, description: 'texto',
            content: null, tcuRelator: null, tcuAutorTese: null, tcuOrgaoJulgador: null,
            tcuDataJulgamento: null, tcuLinkPDF: null, summary: null, themes: null,
            leiArticlesArr: [], url: null, douData: null,
            uploadedAt: new Date(), updatedAt: new Date(),
            entityType: 'IBDA',
            enunciadoNumber: '10',
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload[0]).toMatchObject({
      tribunalCode: 'IBDA',
      tribunalName: 'Instituto Brasileiro de Direito Administrativo',
      decisionType: 'enunciado',
      decisionNumber: '10',
      sourceType: 'document-tcu-enunciado',
    });
  });
});

describe('mapFiltersToSemanticOptions — todos os filtros estruturais', () => {
  it('TCU: aplica todos os filtros no extraWhere de Document', () => {
    const opts = mapFiltersToSemanticOptions({
      tribunal: 'TCU',
      ano: 2024, tema: 'terceirização', artigo: '75', relator: 'Fulano',
      orgao: 'Plenário', dataFrom: '2024-01-01', dataTo: '2024-12-31', q: 'pregão',
    });
    const vals = (opts.extraWhere!.document as { values: unknown[] }).values;
    expect(vals).toEqual(expect.arrayContaining(['75', '%Plenário%', '2024-01-01', '2024-12-31', 2024]));
  });

  it('TCE: aplica todos os filtros no extraWhere de TribunalDecision', () => {
    const opts = mapFiltersToSemanticOptions({
      tribunal: 'TCE-SP',
      ano: 2024, tema: 'terceirização', artigo: '75', decisionType: 'consulta',
      relator: 'Fulano', orgao: 'Plenário', dataFrom: '2024-01-01', dataTo: '2024-12-31', q: 'pregão',
    });
    const vals = (opts.extraWhere!.tribunalDecision as { values: unknown[] }).values;
    expect(vals).toEqual(expect.arrayContaining(['75', 'consulta', '%Fulano%', 2024]));
  });
});

describe('resolveEmenta', () => {
  it('tribunal-decision: usa data.ementa (ou string vazia)', () => {
    expect(resolveEmenta({ source: { kind: 'tribunal-decision', data: { ementa: 'ementa TD' } } } as never)).toBe('ementa TD');
    expect(resolveEmenta({ source: { kind: 'tribunal-decision', data: {} } } as never)).toBe('');
  });

  it('document: cai em tcuEmentaCompleta -> description -> content -> vazio', () => {
    expect(resolveEmenta({ source: { kind: 'document', data: { tcuEmentaCompleta: 'ementa TCU' } } } as never)).toBe('ementa TCU');
    expect(resolveEmenta({ source: { kind: 'document', data: { description: 'desc' } } } as never)).toBe('desc');
    expect(resolveEmenta({ source: { kind: 'document', data: { content: 'conteúdo' } } } as never)).toBe('conteúdo');
    expect(resolveEmenta({ source: { kind: 'document', data: {} } } as never)).toBe('');
  });
});

describe('resolveFullText', () => {
  it('tribunal-decision: usa data.fullText (ou null)', () => {
    expect(resolveFullText({ source: { kind: 'tribunal-decision', data: { fullText: 'inteiro teor' } } } as never)).toBe('inteiro teor');
    expect(resolveFullText({ source: { kind: 'tribunal-decision', data: {} } } as never)).toBeNull();
  });

  it('document: usa data.content (ou null)', () => {
    expect(resolveFullText({ source: { kind: 'document', data: { content: 'conteúdo doc' } } } as never)).toBe('conteúdo doc');
    expect(resolveFullText({ source: { kind: 'document', data: {} } } as never)).toBeNull();
  });
});
