// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch, mockRtfToText, mockUpdate } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockRtfToText: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/tcu/inteiro-teor-fetch', () => ({ fetchInteiroTeor: (...a: unknown[]) => mockFetch(...a) }));
vi.mock('@/lib/tcu/rtf-to-text', () => ({ rtfToText: (...a: unknown[]) => mockRtfToText(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: { document: { update: (...a: unknown[]) => mockUpdate(...a) } },
}));

import { catalogarAcordao } from './catalogar-acordao';

const doc = { id: 'd1', title: 'Acórdão TCU 1/2026', tcuLinkPDF: 'https://x/y.rtf', leiArticlesArr: ['5'] };

// Um acórdão com Relatório/Voto/Acórdão e o princípio da economicidade no voto.
const TEXTO_COM_SECOES = [
  'RELATÓRIO', 'A parte alega ofensa.',
  'VOTO', 'O princípio da economicidade foi desrespeitado. A economicidade exige zelo. Reitero: economicidade.',
  'ACÓRDÃO Nº 1/2026 – TCU – Plenário', 'VISTOS. ACORDAM.',
].join('\n');

describe('catalogarAcordao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('sucesso: persiste análise, texto e debatidos; status ok', async () => {
    mockFetch.mockResolvedValue({ ok: true, buf: Buffer.from('rtf') });
    mockRtfToText.mockResolvedValue(TEXTO_COM_SECOES);

    const r = await catalogarAcordao(doc);

    expect(r.status).toBe('ok');
    expect(r.debatidos).toContain('5');
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.tcuAnalise).toBeDefined();
    expect(data.leiArticlesDebated).toContain('5');
    expect(data.tcuTextoCompleto).toBe(TEXTO_COM_SECOES);
    expect(data.tcuEnriquecimentoStatus).toBe('success');
  });

  it('acórdão só com dispositivo: status ok-sem-secoes, debatidos vazio', async () => {
    mockFetch.mockResolvedValue({ ok: true, buf: Buffer.from('rtf') });
    mockRtfToText.mockResolvedValue('ACÓRDÃO Nº 2/2026 – TCU – Plenário\nMulta aplicada.');

    const r = await catalogarAcordao(doc);

    expect(r.status).toBe('ok-sem-secoes');
    expect(r.debatidos).toEqual([]);
  });

  it('falha de download: status falha, NÃO lança, incrementa tentativas', async () => {
    mockFetch.mockResolvedValue({ ok: false, erro: 'timeout' });

    const r = await catalogarAcordao(doc);

    expect(r.status).toBe('falha');
    expect(r.erro).toBe('timeout');
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.tcuEnriquecimentoStatus).toBe('failed');
    expect(data.tcuAnaliseTentativas).toEqual({ increment: 1 });
    expect(data.tcuTextoCompleto).toBeUndefined(); // não grava texto em falha
  });

  it('falha de extração RTF: status falha, incrementa tentativas, não lança', async () => {
    mockFetch.mockResolvedValue({ ok: true, buf: Buffer.from('rtf') });
    mockRtfToText.mockRejectedValue(new Error('empty control word'));

    const r = await catalogarAcordao(doc);

    expect(r.status).toBe('falha');
    expect(r.erro).toContain('empty control word');
    expect(mockUpdate.mock.calls[0][0].data.tcuAnaliseTentativas).toEqual({ increment: 1 });
  });

  it('trunca texto acima do teto e marca no JSON', async () => {
    mockFetch.mockResolvedValue({ ok: true, buf: Buffer.from('rtf') });
    mockRtfToText.mockResolvedValue('VOTO\n' + 'x'.repeat(600_000));

    const r = await catalogarAcordao(doc);

    expect(r.status).not.toBe('falha');
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.tcuTextoCompleto.length).toBe(500_000);
    expect(data.tcuAnalise.truncado).toBe(true);
  });
});
