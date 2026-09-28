// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findUnique, update, scrapeUrl, processLegislativeAct } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  scrapeUrl: vi.fn(),
  processLegislativeAct: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { legislativeAct: { findUnique, update } } }));
vi.mock('@/lib/legislative-scrapers', () => ({ scrapeUrl }));
vi.mock('@/lib/embeddings/legislative-act-processor', () => ({ processLegislativeAct }));
vi.mock('@/lib/logger', () => ({ apiLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { scrapeAndIndexAct } = await import('../scrape-and-index');

const CONTENT = `MEDIDA PROVISÓRIA Nº 1.303, DE 11 DE JUNHO DE 2025

Dispõe sobre a tributação de aplicações financeiras e ativos virtuais no País.

O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere o art. 62 da Constituição, adota a seguinte Medida Provisória, com força de lei:

Art. 1º Esta Medida Provisória dispõe sobre a tributação de aplicações financeiras.
${'Art. 2º Texto do artigo para dar volume ao conteúdo do ato normativo. '.repeat(30)}`;

const baseAct = {
  id: 'act-1',
  officialUrl: 'https://www.in.gov.br/web/dou/-/medida-provisoria-1',
  content: null,
  contentHash: null,
  fullNumber: 'Medida Provisória 1.303/2025',
  title: 'MEDIDA PROVISÓRIA Nº 1.303, DE 11 DE JUNHO DE 2025',
};

describe('scrapeAndIndexAct: ementa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scrapeUrl.mockResolvedValue({ success: true, content: CONTENT, hash: 'h' });
    processLegislativeAct.mockResolvedValue({ success: true });
    update.mockResolvedValue({});
  });

  it('troca a ementa provisória (título) pela oficial do texto integral', async () => {
    findUnique.mockResolvedValue({ ...baseAct, ementa: baseAct.title });
    await scrapeAndIndexAct('act-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ementa: 'Dispõe sobre a tributação de aplicações financeiras e ativos virtuais no País.',
        }),
      }),
    );
  });

  it('preserva ementa já correta', async () => {
    findUnique.mockResolvedValue({ ...baseAct, ementa: 'Dispõe sobre a tributação de aplicações financeiras.' });
    await scrapeAndIndexAct('act-1');
    const data = update.mock.calls[0][0].data;
    expect(data.content).toBe(CONTENT);
    expect(data).not.toHaveProperty('ementa');
  });
});
