// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockVerifyAuth,
  mockSelecionarElegiveis,
  mockPersistirDestilacao,
  mockBuscar,
  mockColetarTrechos,
  mockMontarPrompt,
  mockParseResposta,
  mockGarantirTema,
  mockNaBase,
  mockGenerate,
  mockRegistrar,
  mockCount,
  mockConvergencia,
} = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockSelecionarElegiveis: vi.fn(),
  mockPersistirDestilacao: vi.fn(),
  mockBuscar: vi.fn(),
  mockColetarTrechos: vi.fn(),
  mockMontarPrompt: vi.fn(),
  mockParseResposta: vi.fn(),
  mockGarantirTema: vi.fn(),
  mockNaBase: vi.fn(),
  mockGenerate: vi.fn(),
  mockRegistrar: vi.fn(),
  mockCount: vi.fn(),
  mockConvergencia: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: (...a: unknown[]) => mockVerifyAuth(...a) }));
vi.mock('@/lib/cron-telemetry', () => ({
  withCronTelemetry: async (_n: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/tcu/persistir-tese', () => ({
  selecionarElegiveis: (...a: unknown[]) => mockSelecionarElegiveis(...a),
  persistirDestilacao: (...a: unknown[]) => mockPersistirDestilacao(...a),
}));
vi.mock('@/lib/tcu/trechos-de-citacao', () => ({
  coletarTrechosDoAlvo: (...a: unknown[]) => mockColetarTrechos(...a),
}));
vi.mock('@/lib/tcu/destilar-tese', () => ({
  montarPromptTese: (...a: unknown[]) => mockMontarPrompt(...a),
  parseRespostaTese: (...a: unknown[]) => mockParseResposta(...a),
}));
// `escolherCandidato` fica REAL — é o filtro completos/relação que decide
// ambíguo x não encontrado, e é exatamente isso que estes testes verificam.
// Só `buscarAcordaoPorNumero` (rede) é mockado.
vi.mock('@/lib/tcu/buscar-acordao-tcu', async () => {
  const real = await vi.importActual<typeof import('@/lib/tcu/buscar-acordao-tcu')>(
    '@/lib/tcu/buscar-acordao-tcu'
  );
  return { ...real, buscarAcordaoPorNumero: (...a: unknown[]) => mockBuscar(...a) };
});
vi.mock('@/lib/tcu/tema-acordao', () => ({
  garantirTemaDeAlvo: (...a: unknown[]) => mockGarantirTema(...a),
  naBase: (...a: unknown[]) => mockNaBase(...a),
}));
vi.mock('@/lib/ai', () => ({ generate: (...a: unknown[]) => mockGenerate(...a) }));
// `classificarCandidatos` fica REAL pelo mesmo motivo de `escolherCandidato`
// acima — é o que estes testes verificam. Só o registro (I/O) é mockado.
vi.mock('@/lib/tcu/resolver-identidade', async () => {
  const real = await vi.importActual<typeof import('@/lib/tcu/resolver-identidade')>(
    '@/lib/tcu/resolver-identidade'
  );
  return { ...real, registrarIdentidadeIrresolvida: (...a: unknown[]) => mockRegistrar(...a) };
});
vi.mock('@/lib/tcu/colegiado-por-convergencia', () => ({
  colegiadoPorConvergencia: (...a: unknown[]) => mockConvergencia(...a),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { teseDestilacao: { count: (...a: unknown[]) => mockCount(...a) } },
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const req = () => new NextRequest('http://localhost/api/cron/destilar-teses-tcu');
// `ementa`/`relator` variam por candidato (não um valor fixo repetido) para
// que uma asserção sobre qual candidato foi escolhido seja diagnóstica —
// com valor fixo, comparar "ementa" com "ementa" passaria mesmo pegando o
// candidato errado.
const cand = (key: string, colegiado: string, isRelacao = false) => ({
  numero: 56,
  ano: 2024,
  colegiado,
  relator: `Rel-${key}`,
  ementa: `ementa-${key}`,
  key,
  link: `https://x/${key}`,
  isRelacao,
});

// Sumidouro do cron (spec 2026-09-04): um alvo que não resolve identidade
// nunca ganha destilação, então nunca sai de `selecionarElegiveis` — sem o
// registro em AlvoIdentidadeIrresolvida ele voltaria ao topo da fila todo dia.
describe('cron destilar-teses-tcu — registro de identidade irresolvida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockVerifyAuth.mockReturnValue(null);
    mockCount.mockResolvedValue(0);
    // Sem convergência por padrão — os testes que a querem sobrescrevem.
    mockConvergencia.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não encontrado (zero candidatos completos), sem convergência: registra "naoEncontrado" e não destila (nível 3)', async () => {
    mockSelecionarElegiveis.mockResolvedValue([{ numero: 56, ano: 2024, chave: '56/2024', noVoto: 10 }]);
    mockBuscar.mockResolvedValue([]); // nenhum candidato devolvido pelo TCU

    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    const body = await r.json();

    expect(mockConvergencia).toHaveBeenCalledWith(56, 2024);
    expect(mockRegistrar).toHaveBeenCalledWith(56, 2024, 'naoEncontrado');
    expect(body.semColegiado).toBe(1);
    expect(body.nivel1).toBe(0);
    expect(body.nivel2).toBe(0);
    expect(mockColetarTrechos).not.toHaveBeenCalled(); // não chegou a destilar
  });

  it('ambíguo (2+ candidatos completos), sem convergência: registra "ambiguo" com a contagem (nível 3)', async () => {
    mockSelecionarElegiveis.mockResolvedValue([{ numero: 56, ano: 2024, chave: '56/2024', noVoto: 10 }]);
    mockBuscar.mockResolvedValue([cand('K1', 'Plenário'), cand('K2', 'Primeira Câmara')]);

    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    const body = await r.json();

    expect(mockRegistrar).toHaveBeenCalledWith(56, 2024, 'ambiguo', 2);
    expect(body.semColegiado).toBe(1);
    expect(mockColetarTrechos).not.toHaveBeenCalled();
  });

  it('erro de rede (erroTransitorio): NÃO registra — o alvo deve voltar à fila amanhã', async () => {
    mockSelecionarElegiveis.mockResolvedValue([{ numero: 56, ano: 2024, chave: '56/2024', noVoto: 10 }]);
    mockBuscar.mockRejectedValue(new Error('ETIMEDOUT'));

    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    const body = await r.json();

    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(body.erros).toBe(1);
  });
});

// Nível 2 de procedência (spec §4.3): identidade oficial ambígua/não
// encontrada, mas os citantes convergem — o cron passa a destilar em vez de
// desistir, escolhendo entre os candidatos o de colegiado convergido.
describe('cron destilar-teses-tcu — destilação por convergência (nível 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockVerifyAuth.mockReturnValue(null);
    mockCount.mockResolvedValue(0);
    mockGarantirTema.mockResolvedValue('licitacoes-contratos');
    mockNaBase.mockReturnValue(true);
    mockColetarTrechos.mockResolvedValue({ trechos: [], contagem: { noVoto: 10, citantesDistintos: 10 } });
    mockMontarPrompt.mockReturnValue({ systemPrompt: 's', userContent: 'u' });
    mockGenerate.mockResolvedValue({ text: '{}' });
    mockParseResposta.mockReturnValue({ chave: '56/2024', assunto: 'a', confianca: 'alta', teses: [{ enunciado: 'e', inovacao: 'i', trechosFonte: [] }] });
    mockPersistirDestilacao.mockResolvedValue({ destilacaoId: 'd1', herdados: 0, novos: 1 });
  });

  afterEach(() => vi.useRealTimers());

  it('ambíguo na identidade oficial, mas citantes convergem: destila com o candidato do colegiado convergido, sem registrar irresolvido', async () => {
    mockSelecionarElegiveis.mockResolvedValue([{ numero: 56, ano: 2024, chave: '56/2024', noVoto: 10 }]);
    // Candidato convergido ('Plenário') NÃO é o primeiro da lista — se a
    // implementação caísse em `cands[0]` (em vez de escolher pelo colegiado
    // convergido), este teste pegaria: o primeiro é Primeira Câmara.
    mockBuscar.mockResolvedValue([
      cand('K-1CAMARA', 'Primeira Câmara'),
      cand('K-PLENARIO', 'Plenário'),
    ]);
    mockConvergencia.mockResolvedValue({ colegiado: 'Plenário', citantes: 7 });

    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    const body = await r.json();

    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(body.nivel2).toBe(1);
    expect(body.nivel1).toBe(0);
    expect(body.semColegiado).toBe(0);
    expect(mockColetarTrechos).toHaveBeenCalled(); // desta vez destilou

    // A ementa usada no prompt é a do candidato Plenário (o que convergiu),
    // não a do primeiro da lista (Primeira Câmara) — como `ementa` varia por
    // candidato, esta comparação falharia se o candidato errado tivesse sido
    // escolhido.
    expect(mockMontarPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ colegiado: 'Plenário', ementaPropria: 'ementa-K-PLENARIO' })
    );

    // acordaoKey continua nulo — convergência não é identidade oficial.
    // relatorAlvo/urlAlvo também identificam o candidato Plenário, não o
    // primeiro da lista.
    const identidadePassada = mockPersistirDestilacao.mock.calls[0][3];
    expect(identidadePassada).toEqual({
      acordaoKey: null,
      colegiadoAlvo: 'Plenário',
      relatorAlvo: 'Rel-K-PLENARIO',
      urlAlvo: 'https://x/K-PLENARIO',
      origemIdentidade: 'convergencia-citantes',
      citantesConcordantes: 7,
    });
  });

  it('convergência resolve um colegiado que não está entre os candidatos buscados: sem ementa confiável, não destila e registra irresolvido', async () => {
    mockSelecionarElegiveis.mockResolvedValue([{ numero: 56, ano: 2024, chave: '56/2024', noVoto: 10 }]);
    mockBuscar.mockResolvedValue([cand('K-1CAMARA', 'Primeira Câmara'), cand('K-2CAMARA', 'Segunda Câmara')]);
    mockConvergencia.mockResolvedValue({ colegiado: 'Plenário', citantes: 5 }); // não bate com nenhum candidato

    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    const body = await r.json();

    expect(mockRegistrar).toHaveBeenCalledWith(56, 2024, 'ambiguo', 2);
    expect(body.semColegiado).toBe(1);
    expect(mockColetarTrechos).not.toHaveBeenCalled();
  });

  it('convergência aponta um colegiado com DOIS candidatos completos (mesmo colegiado): não escolhe no chute, cai para nível 3', async () => {
    mockSelecionarElegiveis.mockResolvedValue([{ numero: 56, ano: 2024, chave: '56/2024', noVoto: 10 }]);
    // Dois candidatos completos do MESMO colegiado — mesmo convergindo para
    // 'Plenário', não há como saber qual dos dois é o certo. `escolherCandidato`
    // exige exatamente um candidato daquele colegiado; com dois, devolve null
    // e o cron cai para nível 3 em vez de pegar o primeiro no chute.
    mockBuscar.mockResolvedValue([cand('K-PLENARIO-A', 'Plenário'), cand('K-PLENARIO-B', 'Plenário')]);
    mockConvergencia.mockResolvedValue({ colegiado: 'Plenário', citantes: 7 });

    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    const body = await r.json();

    expect(mockRegistrar).toHaveBeenCalledWith(56, 2024, 'ambiguo', 2);
    expect(body.nivel2).toBe(0);
    expect(body.semColegiado).toBe(1);
    expect(mockColetarTrechos).not.toHaveBeenCalled();
  });
});
