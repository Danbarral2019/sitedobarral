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
vi.mock('@/lib/tcu/resolver-identidade', () => ({
  registrarIdentidadeIrresolvida: (...a: unknown[]) => mockRegistrar(...a),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { teseDestilacao: { count: (...a: unknown[]) => mockCount(...a) } },
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const req = () => new NextRequest('http://localhost/api/cron/destilar-teses-tcu');
const cand = (key: string, colegiado: string, isRelacao = false) => ({
  numero: 56,
  ano: 2024,
  colegiado,
  relator: 'Rel',
  ementa: 'ementa',
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não encontrado (zero candidatos completos): registra "naoEncontrado" e não destila', async () => {
    mockSelecionarElegiveis.mockResolvedValue([{ numero: 56, ano: 2024, chave: '56/2024', noVoto: 10 }]);
    mockBuscar.mockResolvedValue([]); // nenhum candidato devolvido pelo TCU

    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    const body = await r.json();

    expect(mockRegistrar).toHaveBeenCalledWith(56, 2024, 'naoEncontrado');
    expect(body.ambiguos).toBe(1);
    expect(mockColetarTrechos).not.toHaveBeenCalled(); // não chegou a destilar
  });

  it('ambíguo (2+ candidatos completos): registra "ambiguo" com a contagem de candidatos', async () => {
    mockSelecionarElegiveis.mockResolvedValue([{ numero: 56, ano: 2024, chave: '56/2024', noVoto: 10 }]);
    mockBuscar.mockResolvedValue([cand('K1', 'Plenário'), cand('K2', 'Primeira Câmara')]);

    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    const body = await r.json();

    expect(mockRegistrar).toHaveBeenCalledWith(56, 2024, 'ambiguo', 2);
    expect(body.ambiguos).toBe(1);
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
