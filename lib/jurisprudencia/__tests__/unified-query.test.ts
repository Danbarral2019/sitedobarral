// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapDocumentTcuToDecision,
  shouldIncludeTribunalDecisionBranch,
  shouldIncludeDocumentTcuBranch,
  buildTribunalDecisionWhere,
  buildDocumentTcuWhere,
  type JurisprudenciaFilters,
} from '../unified-query';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: any[]) => mockQueryRaw(...args),
  },
}));

beforeEach(() => {
  mockQueryRaw.mockReset();
});

describe('mapDocumentTcuToDecision', () => {
  it('mapeia todos os campos TCU preenchidos para o shape UnifiedDecision', () => {
    const doc = {
      id: 'doc-1',
      title: 'Acórdão sobre pregão eletrônico',
      description: 'descrição do acórdão',
      content: 'conteúdo longo',
      url: 'https://tcu.gov.br/ac/1106',
      tcuNumeroAcordao: 'AC-1106/24-P',
      tcuEmentaCompleta: 'Ementa completa do acórdão sobre pregão.',
      tcuTextoCompleto: 'Texto integral do acórdão...',
      tcuRelator: 'MIN. AUGUSTO SHERMAN',
      tcuAutorTese: null,
      tcuOrgaoJulgador: 'Plenário',
      tcuDataJulgamento: new Date('2024-05-20T00:00:00Z'),
      tcuLinkPDF: 'https://tcu.gov.br/pdf/1106.pdf',
      tcuArea: 'Licitações',
      tcuTema: 'Pregão',
      tcuSubtema: 'Eletrônico',
      acordaoAno: 2024,
      themes: JSON.stringify(['pregão', 'licitação']),
      leiArticles: JSON.stringify(['17', '18']),
      summary: 'Resumo IA.',
      douData: null,
      uploadedAt: new Date('2024-06-01T00:00:00Z'),
      updatedAt: new Date('2024-06-02T00:00:00Z'),
    };

    const result = mapDocumentTcuToDecision(doc);

    expect(result).toMatchObject({
      id: 'doc-1',
      tribunalCode: 'TCU',
      tribunalName: 'Tribunal de Contas da União',
      decisionType: 'acordao',
      decisionNumber: 'AC-1106/24-P',
      title: 'Acórdão sobre pregão eletrônico',
      ementa: 'Ementa completa do acórdão sobre pregão.',
      fullText: 'Texto integral do acórdão...',
      relator: 'MIN. AUGUSTO SHERMAN',
      orgaoJulgador: 'Plenário',
      dataJulgamento: new Date('2024-05-20T00:00:00Z'),
      pdfUrl: 'https://tcu.gov.br/pdf/1106.pdf',
      year: 2024,
      themes: JSON.stringify(['pregão', 'licitação']),
      leiArticles: JSON.stringify(['17', '18']),
      summary: 'Resumo IA.',
      url: 'https://tcu.gov.br/ac/1106',
      isRelevant: true,
      relevanceScore: 0,
      approvalStatus: 'manually_approved',
      sourceType: 'document-tcu',
      fullIdentifier: 'TCU Acórdão AC-1106/24-P',
      createdAt: new Date('2024-06-01T00:00:00Z'),
      updatedAt: new Date('2024-06-02T00:00:00Z'),
      processNumber: null,
      dataPublicacao: null,
    });
  });

  it('usa fallbacks quando campos TCU estão vazios', () => {
    const doc = {
      id: 'doc-2',
      title: 'Acórdão básico',
      description: 'só descrição',
      content: null,
      url: null,
      tcuNumeroAcordao: null,
      tcuEmentaCompleta: null,
      tcuTextoCompleto: null,
      tcuRelator: null,
      tcuAutorTese: 'AUGUSTO SHERMAN',
      tcuOrgaoJulgador: null,
      tcuDataJulgamento: new Date('2023-03-10T00:00:00Z'),
      tcuLinkPDF: null,
      tcuArea: 'Contratos',
      tcuTema: null,
      tcuSubtema: null,
      acordaoAno: null,
      themes: null,
      leiArticles: null,
      summary: null,
      douData: null,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = mapDocumentTcuToDecision(doc);

    expect(result.decisionNumber).toBe('Acórdão básico'); // fallback para title
    expect(result.ementa).toBe('só descrição'); // fallback description
    expect(result.fullText).toBeNull();
    expect(result.relator).toBe('AUGUSTO SHERMAN'); // fallback tcuAutorTese
    expect(result.year).toBe(2023); // derivado de tcuDataJulgamento
    expect(result.themes).toBe(JSON.stringify(['Contratos'])); // só tcuArea
    expect(result.fullIdentifier).toBe('TCU Acórdão Acórdão básico');
  });

  it('retorna themes null quando não há themes, area, tema nem subtema', () => {
    const doc: any = {
      id: 'doc-3',
      title: 't',
      description: null,
      content: null,
      url: null,
      tcuNumeroAcordao: 'AC-1/24',
      tcuEmentaCompleta: 'e',
      tcuTextoCompleto: null,
      tcuRelator: null,
      tcuAutorTese: null,
      tcuOrgaoJulgador: null,
      tcuDataJulgamento: null,
      tcuLinkPDF: null,
      tcuArea: null,
      tcuTema: null,
      tcuSubtema: null,
      acordaoAno: null,
      themes: null,
      leiArticles: null,
      summary: null,
      douData: null,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = mapDocumentTcuToDecision(doc);

    expect(result.themes).toBeNull();
    expect(result.year).toBeNull();
  });
});

describe('shouldIncludeTribunalDecisionBranch', () => {
  it('inclui quando sem filtros', () => {
    expect(shouldIncludeTribunalDecisionBranch({})).toBe(true);
  });

  it('exclui quando tribunal=TCU', () => {
    expect(
      shouldIncludeTribunalDecisionBranch({ tribunal: 'TCU' })
    ).toBe(false);
  });

  it('inclui quando tribunal=TCE-SP', () => {
    expect(
      shouldIncludeTribunalDecisionBranch({ tribunal: 'TCE-SP' })
    ).toBe(true);
  });

  it('inclui com qualquer decisionType', () => {
    expect(
      shouldIncludeTribunalDecisionBranch({ decisionType: 'sumula' })
    ).toBe(true);
    expect(
      shouldIncludeTribunalDecisionBranch({ decisionType: 'acordao' })
    ).toBe(true);
  });
});

describe('shouldIncludeDocumentTcuBranch', () => {
  it('inclui quando sem filtros', () => {
    expect(shouldIncludeDocumentTcuBranch({})).toBe(true);
  });

  it('inclui quando tribunal=TCU', () => {
    expect(
      shouldIncludeDocumentTcuBranch({ tribunal: 'TCU' })
    ).toBe(true);
  });

  it('exclui quando tribunal=TCE-SP', () => {
    expect(
      shouldIncludeDocumentTcuBranch({ tribunal: 'TCE-SP' })
    ).toBe(false);
  });

  it('exclui quando decisionType não é acordao', () => {
    expect(
      shouldIncludeDocumentTcuBranch({ decisionType: 'sumula' })
    ).toBe(false);
    expect(
      shouldIncludeDocumentTcuBranch({ decisionType: 'parecer_previo' })
    ).toBe(false);
    expect(
      shouldIncludeDocumentTcuBranch({ decisionType: 'decisao' })
    ).toBe(false);
  });

  it('inclui quando decisionType=acordao ou vazio', () => {
    expect(
      shouldIncludeDocumentTcuBranch({ decisionType: 'acordao' })
    ).toBe(true);
    expect(shouldIncludeDocumentTcuBranch({})).toBe(true);
  });

  it('combina filtros: tribunal=TCU + decisionType=sumula = excluído', () => {
    expect(
      shouldIncludeDocumentTcuBranch({
        tribunal: 'TCU',
        decisionType: 'sumula',
      })
    ).toBe(false);
  });
});

describe('buildTribunalDecisionWhere', () => {
  it('inclui condição base sem filtros', () => {
    const where = buildTribunalDecisionWhere({});
    // .text usa placeholders $1, $2, ... (formato PostgreSQL)
    const text = where.text;
    expect(text).toMatch(/"isRelevant"\s*=\s*\$\d+/);
    expect(text).toMatch(/"approvalStatus"\s+IN/);
    expect(where.values).toEqual(
      expect.arrayContaining([true, 'auto_approved', 'manually_approved'])
    );
  });

  it('adiciona filtro de tribunal', () => {
    const where = buildTribunalDecisionWhere({ tribunal: 'TCE-SP' });
    expect(where.text).toMatch(/"tribunalCode"\s*=\s*\$/);
    expect(where.values).toContain('TCE-SP');
  });

  it('adiciona filtro de ano', () => {
    const where = buildTribunalDecisionWhere({ ano: 2024 });
    expect(where.text).toMatch(/year\s*=\s*\$/);
    expect(where.values).toContain(2024);
  });

  it('adiciona filtro de busca textual q em title OR ementa', () => {
    const where = buildTribunalDecisionWhere({ q: 'pregão' });
    expect(where.sql).toMatch(/title ILIKE/);
    expect(where.sql).toMatch(/ementa ILIKE/);
    expect(where.values).toContain('%pregão%');
  });
});

describe('buildDocumentTcuWhere', () => {
  it('inclui condição base sem filtros', () => {
    const where = buildDocumentTcuWhere({});
    expect(where.text).toMatch(/category\s*=\s*\$/);
    expect(where.sql).toMatch(/"tcuNumeroAcordao"\s+IS NOT NULL/);
    expect(where.values).toContain('acordao');
  });

  it('filtro ano casa em acordaoAno OR EXTRACT(YEAR FROM tcuDataJulgamento)', () => {
    const where = buildDocumentTcuWhere({ ano: 2024 });
    expect(where.text).toMatch(/"acordaoAno"\s*=\s*\$/);
    expect(where.sql).toMatch(/EXTRACT\(YEAR FROM "tcuDataJulgamento"\)/);
    // parametrizado com 2024 duas vezes (uma pra cada lado do OR)
    expect(where.values.filter(v => v === 2024)).toHaveLength(2);
  });

  it('filtro tema casa em themes, tcuArea, tcuTema, tcuSubtema', () => {
    const where = buildDocumentTcuWhere({ tema: 'pregão' });
    expect(where.sql).toMatch(/themes ILIKE/);
    expect(where.sql).toMatch(/"tcuArea" ILIKE/);
    expect(where.sql).toMatch(/"tcuTema" ILIKE/);
    expect(where.sql).toMatch(/"tcuSubtema" ILIKE/);
  });

  it('filtro relator casa em tcuRelator OR tcuAutorTese', () => {
    const where = buildDocumentTcuWhere({ relator: 'sherman' });
    expect(where.sql).toMatch(/"tcuRelator" ILIKE/);
    expect(where.sql).toMatch(/"tcuAutorTese" ILIKE/);
  });

  it('filtro q casa em title OR tcuEmentaCompleta', () => {
    const where = buildDocumentTcuWhere({ q: 'contrato' });
    expect(where.sql).toMatch(/title ILIKE/);
    expect(where.sql).toMatch(/"tcuEmentaCompleta" ILIKE/);
  });
});

describe('fetchUnifiedList', () => {
  it('retorna lista vazia sem chamar o banco quando ambos os ramos estão excluídos', async () => {
    const { fetchUnifiedList } = await import('../unified-query');
    const result = await fetchUnifiedList(
      { tribunal: 'TCU', decisionType: 'sumula' },
      { page: 1, pageSize: 10 }
    );
    expect(result).toEqual({ items: [], total: 0 });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('chama $queryRaw duas vezes (items + count) quando há ramos ativos', async () => {
    const { fetchUnifiedList } = await import('../unified-query');
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'td-1',
          tribunalCode: 'TCE-SP',
          tribunalName: 'Tribunal de Contas do Estado de São Paulo',
          decisionType: 'acordao',
          decisionNumber: '1234/2024',
          title: 'Acórdão TCE-SP',
          ementa: 'ementa',
          fullText: null,
          summary: null,
          relator: 'Rel.',
          orgaoJulgador: 'Pleno',
          dataJulgamento: new Date('2024-05-01'),
          dataPublicacao: null,
          themes: null,
          leiArticles: null,
          url: null,
          pdfUrl: null,
          isRelevant: true,
          relevanceScore: 50,
          approvalStatus: 'auto_approved',
          year: 2024,
          processNumber: null,
          fullIdentifier: 'TCE-SP Acórdão 1234/2024',
          sourceType: 'tribunal-decision',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await fetchUnifiedList({}, { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });
});

describe('fetchUnifiedTopK', () => {
  it('retorna [] sem chamar o banco quando ambos os ramos estão excluídos', async () => {
    const { fetchUnifiedTopK } = await import('../unified-query');
    const result = await fetchUnifiedTopK(
      { tribunal: 'TCU', decisionType: 'sumula' },
      5
    );
    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('chama $queryRaw uma vez com LIMIT topK', async () => {
    const { fetchUnifiedTopK } = await import('../unified-query');
    mockQueryRaw.mockResolvedValueOnce([]);
    await fetchUnifiedTopK({}, 3);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    const callArg = mockQueryRaw.mock.calls[0][0];
    expect(callArg.text).toMatch(/LIMIT \$\d+/);
    expect(callArg.values).toContain(3);
  });
});

describe('fetchUnifiedById', () => {
  it('tenta ramo A, retorna match se encontrar', async () => {
    const { fetchUnifiedById } = await import('../unified-query');
    mockQueryRaw.mockResolvedValueOnce([
      { id: 'td-1', sourceType: 'tribunal-decision' },
    ]);
    const result = await fetchUnifiedById('td-1');
    expect(result).toMatchObject({ id: 'td-1', sourceType: 'tribunal-decision' });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('tenta ramo B quando A não encontra', async () => {
    const { fetchUnifiedById } = await import('../unified-query');
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'doc-1', sourceType: 'document-tcu' },
      ]);
    const result = await fetchUnifiedById('doc-1');
    expect(result).toMatchObject({ id: 'doc-1', sourceType: 'document-tcu' });
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });

  it('retorna null quando nenhum ramo encontra', async () => {
    const { fetchUnifiedById } = await import('../unified-query');
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await fetchUnifiedById('inexistente');
    expect(result).toBeNull();
  });
});

describe('countUnifiedApproved', () => {
  it('retorna a soma das duas tabelas', async () => {
    const { countUnifiedApproved } = await import('../unified-query');
    mockQueryRaw.mockResolvedValueOnce([{ total: 424 }]);
    const total = await countUnifiedApproved();
    expect(total).toBe(424);
  });
});
