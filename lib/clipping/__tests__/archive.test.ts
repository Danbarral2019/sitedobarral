// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * O arquivo do clipping ficou vazio por quase três meses (medido em 21/08/2026:
 * 50 dos 77 envios, 301 itens invisíveis) porque `DailyClippingSend.acordaoIdsIncluded`
 * tinha DOIS leitores e só um acompanhou a virada do payload para o formato v2:
 * `parseSentItemsPayload` (dedupe de envios) entendia os dois formatos, e o parser
 * próprio do arquivo devolvia `[]` — silenciosamente — para o formato novo.
 *
 * Estes testes fixam as duas coisas que estavam quebradas: ler o payload v2 e
 * resolver itens que vivem em `TribunalDecision`, não só em `Document`.
 */

const { mockSendFindUnique, mockSendFindMany, mockSendCount, mockDocFindMany, mockTribunalFindMany } =
  vi.hoisted(() => ({
    mockSendFindUnique: vi.fn(),
    mockSendFindMany: vi.fn(),
    mockSendCount: vi.fn(),
    mockDocFindMany: vi.fn(),
    mockTribunalFindMany: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyClippingSend: {
      findUnique: (...a: any[]) => mockSendFindUnique(...a),
      findMany: (...a: any[]) => mockSendFindMany(...a),
      count: (...a: any[]) => mockSendCount(...a),
    },
    document: { findMany: (...a: any[]) => mockDocFindMany(...a) },
    tribunalDecision: { findMany: (...a: any[]) => mockTribunalFindMany(...a) },
  },
}));

import { getArchiveEntry, listArchiveEntries } from '../archive';

const SENT_DATE = new Date('2026-08-21T03:00:00Z');

const PAYLOAD_V2 = JSON.stringify({
  v: 2,
  items: [
    { kind: 'document-tcu', id: 'doc-tcu-1' },
    { kind: 'tribunal-decision', id: 'td-stf-1' },
    { kind: 'tribunal-decision', id: 'td-stj-1' },
  ],
});

const DOC_TCU = {
  id: 'doc-tcu-1',
  title: 'Acórdão TCU 2194/2026 - Plenário',
  description: null,
  url: 'https://tcu.gov.br/x',
  tcuNumeroAcordao: '2194/2026',
  tcuEmentaCompleta: 'Ementa do acórdão do TCU sobre licitação.',
  tcuRelator: 'WALTON ALENCAR',
  tcuOrgaoJulgador: 'Plenário',
  tcuLinkPDF: 'https://tcu.gov.br/x.pdf',
  tcuDataJulgamento: new Date('2026-08-19T00:00:00Z'),
  uploadedAt: new Date('2026-08-20T10:00:00Z'),
  clippingExtract: {
    dispositivos: [{ numero: '9.1', texto: 'determinar ao órgão que...' }],
    extractMethod: 'rtf',
    aiBullets: JSON.stringify(['Ponto um do TCU.']),
  },
};

const TD_STF = {
  id: 'td-stf-1',
  tribunalCode: 'STF',
  tribunalName: 'Supremo Tribunal Federal',
  decisionType: 'decisao',
  decisionNumber: '1608084',
  title: 'ARE 1608084',
  ementa: 'Decisão monocrática do STF sobre licitação.',
  fullText: null,
  relator: 'LUIZ FUX',
  orgaoJulgador: null,
  dataJulgamento: new Date('2026-06-02T00:00:00Z'),
  url: 'https://jurisprudencia.stf.jus.br/x',
  pdfUrl: null,
  relevanceScore: 90,
  createdAt: new Date('2026-08-20T11:00:00Z'),
  aiBullets: JSON.stringify(['Ponto um do STF.']),
};

const TD_STJ = {
  ...TD_STF,
  id: 'td-stj-1',
  tribunalCode: 'STJ',
  tribunalName: 'Superior Tribunal de Justiça',
  decisionType: 'acordao',
  decisionNumber: '202600138141',
  title: 'AgInt no AREsp 202600138141 - STJ',
  orgaoJulgador: 'SEGUNDA TURMA',
  aiBullets: null,
};

beforeEach(() => {
  for (const m of [mockSendFindUnique, mockSendFindMany, mockSendCount, mockDocFindMany, mockTribunalFindMany]) {
    m.mockReset();
  }
  mockSendFindUnique.mockResolvedValue({
    sentDate: SENT_DATE,
    status: 'success',
    acordaoIdsIncluded: PAYLOAD_V2,
  });
  mockDocFindMany.mockResolvedValue([DOC_TCU]);
  mockTribunalFindMany.mockResolvedValue([TD_STF, TD_STJ]);
});

describe('getArchiveEntry — payload v2', () => {
  it('exibe os itens do envio em vez de uma página vazia', async () => {
    const entry = await getArchiveEntry(SENT_DATE);
    const total = entry!.groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(3);
  });

  it('resolve itens que vivem em TribunalDecision, não só em Document', async () => {
    const entry = await getArchiveEntry(SENT_DATE);
    const codigos = entry!.groups.map((g) => g.tribunalCode);
    expect(codigos).toContain('STF');
    expect(codigos).toContain('STJ');
  });

  it('não acusa de indisponível o item que está na base, em outra tabela', async () => {
    const entry = await getArchiveEntry(SENT_DATE);
    expect(entry!.missingIds).toEqual([]);
  });

  it('agrupa por tribunal preservando a ordem do envio', async () => {
    const entry = await getArchiveEntry(SENT_DATE);
    expect(entry!.groups.map((g) => g.tribunalCode)).toEqual(['TCU', 'STF', 'STJ']);
  });

  it('carrega os bullets já persistidos, sem gerar IA na leitura do arquivo', async () => {
    const entry = await getArchiveEntry(SENT_DATE);
    const stf = entry!.groups.find((g) => g.tribunalCode === 'STF')!;
    expect(stf.items[0].aiBullets).toEqual(['Ponto um do STF.']);
    const tcu = entry!.groups.find((g) => g.tribunalCode === 'TCU')!;
    expect(tcu.items[0].dispositivos).toHaveLength(1);
  });

  it('continua lendo o formato legado, que é array de Document.id', async () => {
    mockSendFindUnique.mockResolvedValue({
      sentDate: SENT_DATE,
      status: 'success',
      acordaoIdsIncluded: JSON.stringify(['doc-tcu-1']),
    });
    mockTribunalFindMany.mockResolvedValue([]);
    const entry = await getArchiveEntry(SENT_DATE);
    expect(entry!.groups[0].items[0].item.sourceId).toBe('doc-tcu-1');
  });

  it('marca como indisponível só o id que sumiu das duas tabelas', async () => {
    mockDocFindMany.mockResolvedValue([]);
    mockTribunalFindMany.mockResolvedValue([TD_STF, TD_STJ]);
    const entry = await getArchiveEntry(SENT_DATE);
    expect(entry!.missingIds).toEqual(['doc-tcu-1']);
  });
});

describe('listArchiveEntries — preview', () => {
  it('mostra preview de um envio que só tem itens de tribunal', async () => {
    mockSendFindMany.mockResolvedValue([
      { sentDate: SENT_DATE, status: 'success', acordaoCount: 2, totalSent: 10, acordaoIdsIncluded: JSON.stringify({ v: 2, items: [{ kind: 'tribunal-decision', id: 'td-stf-1' }] }) },
    ]);
    mockSendCount.mockResolvedValue(1);
    mockDocFindMany.mockResolvedValue([]);
    const { entries } = await listArchiveEntries({ limit: 5 });
    expect(entries[0].preview).not.toBe('(sem preview)');
    expect(entries[0].preview).toContain('ARE 1608084');
  });
});
