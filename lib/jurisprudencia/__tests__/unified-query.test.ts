// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mapDocumentTcuToDecision } from '../unified-query';

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
