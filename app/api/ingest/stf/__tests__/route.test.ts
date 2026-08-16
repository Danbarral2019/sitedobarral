// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockVerify, mockPersistir, mockHealth } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockPersistir: vi.fn(),
  mockHealth: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: (...a: unknown[]) => mockVerify(...a) }));

// Mock TOTAL, sem importOriginal: carregar o módulo real puxaria
// `@/lib/prisma`, que tentaria abrir conexão no ambiente de teste.
vi.mock('@/lib/stf/persistir', () => ({
  persistirDecisoesStf: (...a: unknown[]) => mockPersistir(...a),
}));

vi.mock('@/lib/tribunal-scrapers/utils', () => ({
  logScraperHealth: (...a: unknown[]) => mockHealth(...a),
  normalizeTribunalCode: (c: string) => c.trim().toUpperCase(),
}));

import { POST, SCRAPER_CODE_STF } from '../route';

const ACORDAO = {
  base: 'acordaos',
  id: 'sjur1',
  titulo: 'ADI 7764',
  processo_classe_processual_unificada_classe_sigla: 'ADI',
  julgamento_data: '2026-02-25',
  ementa_texto: 'Ementa: LICITAÇÃO. Dispensa indevida de certame licitatório público.',
  documental_legislacao_citada_texto: ['LEG-FED   LEI-014133 ANO-2021\n ART-00075'],
};

function req(body: unknown): NextRequest {
  return new NextRequest('https://exemplo.test/api/ingest/stf', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockReturnValue(null);
  mockPersistir.mockResolvedValue({
    criados: 1, atualizados: 0, ignorados: 0, erros: 0, mensagensErro: [],
  });
});

describe('POST /api/ingest/stf', () => {
  it('rejeita requisição sem CRON_SECRET válido', async () => {
    mockVerify.mockReturnValue(NextResponse.json({ error: 'nao autorizado' }, { status: 401 }));
    const res = await POST(req({ documentos: [ACORDAO] }));
    expect(res.status).toBe(401);
    expect(mockPersistir).not.toHaveBeenCalled();
  });

  it('normaliza, aplica o recorte e persiste', async () => {
    const res = await POST(req({ documentos: [ACORDAO] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, recebidos: 1, selecionados: 1, criados: 1 });
    expect(mockPersistir).toHaveBeenCalledTimes(1);
  });

  it('registra sucesso no health log', async () => {
    await POST(req({ documentos: [ACORDAO] }));
    expect(mockHealth).toHaveBeenCalledWith(
      SCRAPER_CODE_STF, 'success', expect.objectContaining({ itemsNew: 1 })
    );
  });

  it('trata lote vazio como FALHA, não como sucesso', async () => {
    const res = await POST(req({ documentos: [] }));
    expect(res.status).toBe(422);
    expect(mockHealth).toHaveBeenCalledWith(
      SCRAPER_CODE_STF, 'failure', expect.objectContaining({
        errorMessage: expect.stringContaining('lote vazio'),
      })
    );
    expect(mockPersistir).not.toHaveBeenCalled();
  });

  it('rejeita corpo malformado', async () => {
    const res = await POST(req({ nada: true }));
    expect(res.status).toBe(400);
  });

  it('registra partial_failure quando há erros de persistência', async () => {
    mockPersistir.mockResolvedValue({
      criados: 0, atualizados: 0, ignorados: 0, erros: 1, mensagensErro: ['sjur1: boom'],
    });
    await POST(req({ documentos: [ACORDAO] }));
    expect(mockHealth).toHaveBeenCalledWith(
      SCRAPER_CODE_STF, 'partial_failure', expect.objectContaining({ itemsError: 1 })
    );
  });
});
