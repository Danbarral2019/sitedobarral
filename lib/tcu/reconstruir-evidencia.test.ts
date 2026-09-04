// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockColetar, mockCitantes } = vi.hoisted(() => ({ mockColetar: vi.fn(), mockCitantes: vi.fn() }));
vi.mock('./trechos-de-citacao', () => ({ coletarTrechosDoAlvo: (...a: unknown[]) => mockColetar(...a) }));
vi.mock('./citantes-do-dossie', () => ({ citantesDoDossie: (...a: unknown[]) => mockCitantes(...a) }));

import { reconstruirEvidencia } from './reconstruir-evidencia';

const dossieCom = (n: number) => ({
  alvo: { numero: 1441, ano: 2016 },
  contagem: { citantesDistintos: n, noVoto: n, ocorrenciasTotal: n },
  trechos: Array.from({ length: n }, (_, i) => ({
    origemChave: `${100 + i}/2020`, secao: 'voto' as const, noVoto: true,
    trecho: `trecho ${i}`, offset: 0,
  })),
});

const destilacao = { id: 'd1', numeroAlvo: 1441, anoAlvo: 2016, criadoEm: new Date('2026-08-01'), dossieTrechos: 3 };

describe('reconstruirEvidencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCitantes.mockResolvedValue(new Map([
      ['100/2020', { id: 'doc-100', acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: 'Plenário', url: 'https://u/100', tcuLinkPDF: 'https://p/100' }],
    ]));
  });

  it('reconstrói com o corte temporal da destilação', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(mockColetar).toHaveBeenCalledWith(
      { numero: 1441, ano: 2016 },
      { ateData: new Date('2026-08-01') },
    );
  });

  it('recusa quando a contagem não casa com dossieTrechos', async () => {
    mockColetar.mockResolvedValue(dossieCom(5)); // gravado 3, agora 5
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(r.status).toBe('contagem-divergente');
    expect(r.linhasPorEnunciado).toEqual({});
  });

  it('copia url e pdf do citante para o trecho', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(r.status).toBe('ok');
    expect(r.linhasPorEnunciado['e1'][0]).toMatchObject({
      ordem: 0, origemNumero: 100, origemAno: 2020,
      origemDocumentId: 'doc-100', origemUrl: 'https://u/100', origemLinkPDF: 'https://p/100',
    });
  });

  it('descarta o enunciado inteiro quando um índice declarado está fora do dossiê', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0, 9] }]);
    expect(r.linhasPorEnunciado['e1']).toBeUndefined();
  });

  it('descarta trecho sem nenhum caminho para o inteiro teor', async () => {
    mockCitantes.mockResolvedValue(new Map()); // citante não está na base
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    // Sem Document, sem url e sem pdf: não há como conferir a evidência.
    expect(r.linhasPorEnunciado['e1']).toBeUndefined();
  });

  it('índices repetidos colapsam numa linha só', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0, 0] }]);
    expect(r.linhasPorEnunciado['e1']).toHaveLength(1);
  });
});
