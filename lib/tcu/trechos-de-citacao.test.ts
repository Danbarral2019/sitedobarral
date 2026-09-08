import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recortarTrechos, montarDossie } from './trechos-de-citacao';

const { mockArestas, mockDocs } = vi.hoisted(() => ({
  mockArestas: vi.fn(),
  mockDocs: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    acordaoCitacao: { findMany: (...a: unknown[]) => mockArestas(...a) },
    document: { findMany: (...a: unknown[]) => mockDocs(...a) },
  },
}));

const VOTO = 'VOTO';
// Texto sintético com relatório + voto. A citação ao alvo 1441/2016 cai no voto.
const texto =
  'RELATÓRIO\n' +
  'Trata-se de tomada de contas. '.repeat(20) +
  '\n' + VOTO + '\n' +
  'A jurisprudência é firme. Conforme o Acórdão 1441/2016-Plenário, o prazo prescricional das ' +
  'sanções aplicadas pelo Tribunal subordina-se ao prazo geral de cinco anos. ' +
  'Assim, ' + 'segue a fundamentação. '.repeat(10) +
  '\nACÓRDÃO\nVISTOS, os Ministros decidem.';

describe('recortarTrechos', () => {
  it('recorta a janela ao redor da citação e marca noVoto', () => {
    const ts = recortarTrechos(texto, { numero: 1441, ano: 2016 }, '9999/2020');
    expect(ts).toHaveLength(1);
    expect(ts[0].origemChave).toBe('9999/2020');
    expect(ts[0].noVoto).toBe(true);
    expect(ts[0].secao).toBe('voto');
    expect(ts[0].trecho).toContain('prazo prescricional das sanções');
    expect(ts[0].trecho).toContain('Acórdão 1441/2016');
  });

  it('ignora citações a outros acórdãos', () => {
    const ts = recortarTrechos(texto, { numero: 9999, ano: 1999 }, '9999/2020');
    expect(ts).toHaveLength(0);
  });

  it('retorna vazio para texto vazio', () => {
    expect(recortarTrechos('', { numero: 1441, ano: 2016 }, 'x')).toEqual([]);
  });
});

describe('montarDossie', () => {
  const t = (origemChave: string, noVoto: boolean, trecho: string): import('./trechos-de-citacao').TrechoCitacao =>
    ({ origemChave, secao: noVoto ? 'voto' : 'relatorio', noVoto, trecho, offset: 0 });

  it('prioriza trechos no voto e conta citantes distintos', () => {
    const d = montarDossie({ numero: 1441, ano: 2016 }, [
      t('1/2020', false, 'menção de rotina no relatório sobre o tema aqui'),
      t('2/2021', true, 'no voto: o prazo prescricional é de cinco anos conforme o precedente'),
      t('2/2021', true, 'no voto: segunda ocorrência no mesmo acórdão citante distinta'),
    ]);
    expect(d.trechos[0].noVoto).toBe(true); // voto vem primeiro
    expect(d.contagem.citantesDistintos).toBe(2); // 1/2020 e 2/2021
    expect(d.contagem.noVoto).toBe(1); // só 2/2021 tem trecho no voto
    expect(d.contagem.ocorrenciasTotal).toBe(3);
  });

  it('deduplica trechos boilerplate quase idênticos', () => {
    const boiler = 'No mesmo sentido, os Acórdãos 1441/2016 e 534/2023, ambos do Plenário.';
    const d = montarDossie({ numero: 1441, ano: 2016 }, [
      t('1/2020', true, boiler),
      t('2/2020', true, boiler + ' '), // idêntico após normalizar
    ]);
    expect(d.trechos).toHaveLength(1);
  });

  it('respeita o limite de trechos', () => {
    const muitos = Array.from({ length: 60 }, (_, i) => t(`${i}/2020`, true, `trecho único número ${i} com conteúdo`));
    const d = montarDossie({ numero: 1441, ano: 2016 }, muitos, 40);
    expect(d.trechos).toHaveLength(40);
  });
});

describe('montarDossie — determinismo', () => {
  // Três trechos que empatam em noVoto E em comprimento. Sem desempate
  // explícito, a ordem final é a ordem de entrada — e a ordem de entrada
  // vem de um findMany sem orderBy, ou seja, indefinida.
  const empatados = [
    { origemChave: '300/2020', secao: 'voto' as const, noVoto: true, trecho: 'AAA', offset: 0 },
    { origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'BBB', offset: 0 },
    { origemChave: '200/2020', secao: 'voto' as const, noVoto: true, trecho: 'CCC', offset: 0 },
  ];

  it('desempata por origemChave, independente da ordem de entrada', () => {
    const alvo = { numero: 1441, ano: 2016 };
    const direta = montarDossie(alvo, empatados).trechos.map((t) => t.trecho);
    const invertida = montarDossie(alvo, [...empatados].reverse()).trechos.map((t) => t.trecho);
    expect(direta).toEqual(invertida);
    // 100/2020 < 200/2020 < 300/2020 → BBB, CCC, AAA
    expect(direta).toEqual(['BBB', 'CCC', 'AAA']);
  });

  it('mantém voto antes de não-voto e mais longo antes de mais curto', () => {
    const d = montarDossie({ numero: 1441, ano: 2016 }, [
      { origemChave: '100/2020', secao: 'relatorio' as const, noVoto: false, trecho: 'nao-voto', offset: 0 },
      { origemChave: '900/2020', secao: 'voto' as const, noVoto: true, trecho: 'curto', offset: 0 },
      { origemChave: '800/2020', secao: 'voto' as const, noVoto: true, trecho: 'trecho bem mais longo', offset: 0 },
    ]);
    expect(d.trechos.map((t) => t.trecho)).toEqual(['trecho bem mais longo', 'curto', 'nao-voto']);
  });
});

describe('coletarTrechosDoAlvo — corte temporal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArestas.mockResolvedValue([]);
    mockDocs.mockResolvedValue([]);
  });

  it('sem ateData, não filtra por criadoEm', async () => {
    const { coletarTrechosDoAlvo } = await import('./trechos-de-citacao');
    await coletarTrechosDoAlvo({ numero: 1441, ano: 2016 });
    expect(mockArestas.mock.calls[0][0].where.criadoEm).toBeUndefined();
  });

  it('com ateData, filtra arestas anteriores à data', async () => {
    const { coletarTrechosDoAlvo } = await import('./trechos-de-citacao');
    const corte = new Date('2026-08-01T00:00:00Z');
    await coletarTrechosDoAlvo({ numero: 1441, ano: 2016 }, { ateData: corte });
    expect(mockArestas.mock.calls[0][0].where.criadoEm).toEqual({ lt: corte });
  });

  it('ordena as arestas para não depender da ordem do banco', async () => {
    const { coletarTrechosDoAlvo } = await import('./trechos-de-citacao');
    await coletarTrechosDoAlvo({ numero: 1441, ano: 2016 });
    expect(mockArestas.mock.calls[0][0].orderBy).toEqual({ origemId: 'asc' });
  });

  it('carrega o id do Document citante em cada trecho, não só a chave', async () => {
    // A chave "numero/ano" não identifica um acórdão do TCU; o id sim. Sem
    // propagá-lo, a evidência resolveria o citante por um par ambíguo (C1).
    mockArestas.mockResolvedValue([{ origemId: 'doc-x', noVoto: true, ocorrencias: 1 }]);
    mockDocs.mockResolvedValue([
      { id: 'doc-x', acordaoNumero: 900, acordaoAno: 2022, tcuTextoCompleto: texto },
    ]);
    const { coletarTrechosDoAlvo } = await import('./trechos-de-citacao');
    const d = await coletarTrechosDoAlvo({ numero: 1441, ano: 2016 });
    expect(d.trechos).toHaveLength(1);
    expect(d.trechos[0]).toMatchObject({ origemChave: '900/2022', origemDocumentId: 'doc-x' });
  });
});
