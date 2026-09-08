// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockColetar, mockCitantes } = vi.hoisted(() => ({ mockColetar: vi.fn(), mockCitantes: vi.fn() }));
vi.mock('./trechos-de-citacao', () => ({ coletarTrechosDoAlvo: (...a: unknown[]) => mockColetar(...a) }));
// `citanteDoTrecho` NÃO é mockada: é a regra pura de resolução (id primeiro,
// chave só como contingência) que o C1 corrigiu, e é ela que se quer exercitar.
vi.mock('./citantes-do-dossie', async (original) => ({
  ...(await original<typeof import('./citantes-do-dossie')>()),
  citantesDoDossie: (...a: unknown[]) => mockCitantes(...a),
}));

import { reconstruirEvidencia } from './reconstruir-evidencia';

const dossieCom = (n: number) => ({
  alvo: { numero: 1441, ano: 2016 },
  contagem: { citantesDistintos: n, noVoto: n, ocorrenciasTotal: n },
  trechos: Array.from({ length: n }, (_, i) => ({
    origemChave: `${100 + i}/2020`, origemDocumentId: `doc-${100 + i}`,
    secao: 'voto' as const, noVoto: true,
    trecho: `trecho ${i}`, offset: 0,
  })),
});

const doc = (id: string, numero: number, over: Record<string, unknown> = {}) => ({
  id, acordaoNumero: numero, acordaoAno: 2020, tcuOrgaoJulgador: 'Plenário',
  url: `https://u/${id}`, tcuLinkPDF: `https://p/${id}`, ...over,
});

const destilacao = { id: 'd1', numeroAlvo: 1441, anoAlvo: 2016, criadoEm: new Date('2026-08-01'), dossieTrechos: 3 };

describe('reconstruirEvidencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCitantes.mockResolvedValue({
      porId: new Map([
        ['doc-100', { id: 'doc-100', acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: 'Plenário', url: 'https://u/100', tcuLinkPDF: 'https://p/100' }],
      ]),
      porChave: new Map(),
    });
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
    mockCitantes.mockResolvedValue({ porId: new Map(), porChave: new Map() }); // citante fora da base
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

  // C1: número+ano NÃO identifica um acórdão do TCU (o mesmo par existe em
  // colegiados diferentes). A resolução tem de ser pelo id do Document que
  // produziu o trecho, ou a evidência aponta para o inteiro teor errado.
  it('resolve o citante pelo id, não pela chave, quando há dois Document no mesmo número/ano', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    mockCitantes.mockResolvedValue({
      porId: new Map([
        ['doc-100', doc('doc-100', 100)],
        ['doc-100-camara', doc('doc-100-camara', 100, { tcuOrgaoJulgador: 'Primeira Câmara' })],
      ]),
      // O índice de contingência ficaria com um dos dois — aqui, o errado.
      porChave: new Map([['100/2020', doc('doc-100-camara', 100, { tcuOrgaoJulgador: 'Primeira Câmara' })]]),
    });
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(r.linhasPorEnunciado['e1'][0]).toMatchObject({
      origemDocumentId: 'doc-100',
      origemColegiado: 'Plenário',
      origemUrl: 'https://u/doc-100',
      origemLinkPDF: 'https://p/doc-100',
    });
  });

  it('cai na chave quando o trecho não traz id — contingência do dado antigo', async () => {
    mockColetar.mockResolvedValue({
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 3, noVoto: 3, ocorrenciasTotal: 3 },
      trechos: Array.from({ length: 3 }, (_, i) => ({
        origemChave: `${100 + i}/2020`, secao: 'voto' as const, noVoto: true,
        trecho: `trecho ${i}`, offset: 0,
      })),
    });
    mockCitantes.mockResolvedValue({
      porId: new Map(),
      porChave: new Map([['100/2020', doc('doc-100', 100)]]),
    });
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(r.linhasPorEnunciado['e1'][0]).toMatchObject({ origemDocumentId: 'doc-100' });
  });
});

describe('reconstruirEvidencia — descartados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCitantes.mockResolvedValue({
      porId: new Map([['doc-100', doc('doc-100', 100)]]),
      porChave: new Map(),
    });
  });

  it('conta todos os enunciados quando a contagem do dossiê diverge', async () => {
    mockColetar.mockResolvedValue(dossieCom(5)); // gravado 3, agora 5
    const r = await reconstruirEvidencia(destilacao, [
      { id: 'e1', trechosFonte: [0] },
      { id: 'e2', trechosFonte: [1] },
    ]);
    expect(r.descartados).toBe(2);
  });

  it('conta o enunciado que não declara índice nenhum', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [
      { id: 'e1', trechosFonte: [0] },
      { id: 'e2', trechosFonte: [] },
    ]);
    expect(r.descartados).toBe(1);
    expect(r.linhasPorEnunciado['e1']).toHaveLength(1);
  });

  it('conta o enunciado invalidado por trecho sem caminho para o inteiro teor', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    // Só o trecho 0 tem citante resolvido; o enunciado que usa o 1 cai inteiro.
    const r = await reconstruirEvidencia(destilacao, [
      { id: 'e1', trechosFonte: [0] },
      { id: 'e2', trechosFonte: [1] },
    ]);
    expect(r.descartados).toBe(1);
    expect(r.linhasPorEnunciado['e2']).toBeUndefined();
  });

  it('é zero quando todos os enunciados resolvem', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(r.descartados).toBe(0);
  });
});
