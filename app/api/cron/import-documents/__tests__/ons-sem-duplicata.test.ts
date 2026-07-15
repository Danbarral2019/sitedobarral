// @vitest-environment node
/**
 * Regressão: o cron NÃO pode criar registros-fantasma de ON.
 *
 * Bug original (auditoria 2026-07-15): este cron reimplementava a importação de
 * ON à mão, com três defeitos que se somavam:
 *
 *   1. DEDUP FURADA — procurava o existente por `title: on.numero` ("ON 94/2024"),
 *      que nunca casa com o título canônico gravado pelo import do admin
 *      ("Orientação Normativa AGU nº 94/2024"). Resultado: SEMPRE criava um novo.
 *      A regra do projeto (CLAUDE.md) é deduplicar ON por `onNumber + onYear`.
 *   2. TÍTULO ERRADO — gravava `on.numero` (abreviado) em vez de `on.titulo`.
 *   3. SEM `content` — o registro nascia sem texto, e o RAG caía na `description`.
 *
 * Efeito: 57 ONs duplicadas em produção, cada uma com um fantasma sem content e
 * sem url (link quebrado). Apagados em 15/07; este teste impede que voltem.
 *
 * Correção: usar `importOrientacoesNormativasWithVersioning`, o helper que já
 * existia e faz dedup por onNumber+onYear com versionamento.
 *
 * Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockScrapeAGU,
  mockImportOns,
  mockDocumentCreate,
  mockDocumentFindFirst,
  mockFetchAcordaos,
} = vi.hoisted(() => ({
  mockScrapeAGU: vi.fn(),
  mockImportOns: vi.fn(),
  mockDocumentCreate: vi.fn(),
  mockDocumentFindFirst: vi.fn(),
  mockFetchAcordaos: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => null }));
vi.mock('@/lib/cron-telemetry', () => ({
  withCronTelemetry: async (_n: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/agu-scraper-v4', () => ({ scrapeAGU: (...a: unknown[]) => mockScrapeAGU(...a) }));
vi.mock('@/lib/agu-modules/orientacoes-normativas', () => ({
  importOrientacoesNormativasWithVersioning: (...a: unknown[]) => mockImportOns(...a),
}));
vi.mock('@/lib/tcu-scraper', () => ({ fetchAcordaosTCU: (...a: unknown[]) => mockFetchAcordaos(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      create: (...a: unknown[]) => mockDocumentCreate(...a),
      findFirst: (...a: unknown[]) => mockDocumentFindFirst(...a),
    },
  },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const req = () => new NextRequest('http://localhost/api/cron/import-documents');

/** ON como o scraper a devolve: `numero` é display abreviado, `titulo` é canônico. */
const onFake = {
  numero: 'ON 94/2024',
  numeroInt: 94,
  ano: 2024,
  titulo: 'Orientação Normativa AGU nº 94/2024',
  descricao: 'I - O cônjuge do Presidente da República…',
  url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu',
  urlPDF: undefined,
  tags: ['AGU'],
  temas: [],
  cursosIds: [],
  relevanciaScore: 50,
};

describe('cron import-documents — ONs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAcordaos.mockResolvedValue([]);
    mockScrapeAGU.mockResolvedValue({ results: [{ documentos: [onFake] }] });
    mockImportOns.mockResolvedValue({
      total: 1, novos: 1, atualizados: 0, semMudancas: 0, erros: 0, detalhes: [],
    });
  });

  it('delega ao helper com versionamento (dedup por onNumber+onYear)', async () => {
    await GET(req());
    expect(mockImportOns).toHaveBeenCalledTimes(1);
    const [docs] = mockImportOns.mock.calls[0];
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ numeroInt: 94, ano: 2024 });
  });

  it('NÃO cria Document de ON na mão (era o gerador dos fantasmas)', async () => {
    await GET(req());
    // Qualquer create com category orientacao-normativa é regressão.
    const onCreates = mockDocumentCreate.mock.calls.filter(
      (c) => c[0]?.data?.category === 'orientacao-normativa'
    );
    expect(onCreates).toHaveLength(0);
  });

  it('NÃO usa a dedup furada por title', async () => {
    await GET(req());
    const byTitle = mockDocumentFindFirst.mock.calls.filter((c) =>
      JSON.stringify(c[0]?.where ?? {}).includes('ON 94/2024')
    );
    expect(byTitle).toHaveLength(0);
  });

  it('preserva a política do cron: ON nova entra privada, para revisão', async () => {
    await GET(req());
    const [, overrides] = mockImportOns.mock.calls[0];
    expect(overrides).toMatchObject({ isPublic: false, reviewed: false });
  });
});
