import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TeseDestilada } from './destilar-tese';
import type { DossieUso, TrechoCitacao } from './trechos-de-citacao';

const { mockFindFirst, mockFindMany, mockTransaction, mockQueryRaw } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teseDestilacao: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

import { ehElegivel, selecionarElegiveis, persistirDestilacao, MIN_NO_VOTO, FATOR_CRESCIMENTO, DIAS_MINIMOS } from './persistir-tese';

const agora = new Date('2026-07-21T12:00:00Z');
const diasAtras = (n: number) => new Date(agora.getTime() - n * 24 * 60 * 60 * 1000);

describe('ehElegivel — nunca destilado', () => {
  it('entra na fila com 5 citantes no voto', () => expect(ehElegivel(5, null, agora)).toBe(true));
  it('entra com mais de 5', () => expect(ehElegivel(40, null, agora)).toBe(true));
  it('NAO entra com 4 — abaixo do limiar em que o motor produz tese', () =>
    expect(ehElegivel(4, null, agora)).toBe(false));
  it('NAO entra com zero', () => expect(ehElegivel(0, null, agora)).toBe(false));
});

describe('ehElegivel — ja destilado', () => {
  it('redestila quando cresceu 50% e passaram mais de 7 dias', () =>
    expect(ehElegivel(15, { dossieNoVoto: 10, criadoEm: diasAtras(8) }, agora)).toBe(true));

  it('NAO redestila quando cresceu pouco, mesmo com muito tempo', () =>
    expect(ehElegivel(14, { dossieNoVoto: 10, criadoEm: diasAtras(90) }, agora)).toBe(false));

  it('NAO redestila quando cresceu muito mas e recente — evita cascata durante a campanha', () =>
    expect(ehElegivel(100, { dossieNoVoto: 10, criadoEm: diasAtras(1) }, agora)).toBe(false));

  it('NAO redestila exatamente em 7 dias (exige MAIS de 7)', () =>
    expect(ehElegivel(20, { dossieNoVoto: 10, criadoEm: diasAtras(7) }, agora)).toBe(false));

  it('NAO redestila se o dossie encolheu', () =>
    expect(ehElegivel(5, { dossieNoVoto: 40, criadoEm: diasAtras(30) }, agora)).toBe(false));
});

describe('constantes travadas pela spec', () => {
  it('os tres limiares sao os da spec', () => {
    expect(MIN_NO_VOTO).toBe(5);
    expect(FATOR_CRESCIMENTO).toBe(1.5);
    expect(DIAS_MINIMOS).toBe(7);
  });
});

// ── persistirDestilacao — mocka o Prisma na convencao de catalogar-acordao.test.ts ──

type TxMock = {
  teseDestilacao: {
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function trecho(overrides: Partial<TrechoCitacao> = {}): TrechoCitacao {
  return { origemChave: '2/2026', secao: 'voto', noVoto: true, trecho: 'trecho padrao', offset: 0, ...overrides };
}

function fazerDossie(trechos: TrechoCitacao[] = []): DossieUso {
  const noVoto = trechos.filter((t) => t.noVoto).length;
  return {
    alvo: { numero: 1, ano: 2026 },
    contagem: { citantesDistintos: noVoto, noVoto, ocorrenciasTotal: trechos.length },
    trechos,
  };
}

describe('persistirDestilacao', () => {
  let ultimoTx: TxMock;

  beforeEach(() => {
    vi.clearAllMocks();
    // A transacao real so expoe `updateMany`/`create` (nao `update` por id) —
    // se o codigo regredir para `update(anterior.id)` o mock nao tem esse
    // metodo e o teste quebra com um erro claro, em vez de passar por acaso.
    mockTransaction.mockImplementation(async (cb: (tx: TxMock) => Promise<unknown>) => {
      ultimoTx = {
        teseDestilacao: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockImplementation((args: { data: unknown }) =>
            Promise.resolve({ id: 'nova-destilacao-id', ...(args.data as object) })
          ),
        },
      };
      return cb(ultimoTx);
    });
  });

  it('(a) sem versao anterior: tudo conta como novo, nada herdado', async () => {
    mockFindFirst.mockResolvedValue(null);
    const tese: TeseDestilada = {
      chave: '1/2026',
      assunto: 'Assunto X',
      teses: [
        { enunciado: 'Enunciado 1', inovacao: 'i1', trechosFonte: [0] },
        { enunciado: 'Enunciado 2', inovacao: 'i2', trechosFonte: [1] },
      ],
      sinaisQualitativos: [],
      divergencias: [{ origemChave: '3/2026', precedenteApontado: '9/2020', trecho: 'trecho div', natureza: 'foo' }],
      confianca: 'alta',
    };

    const r = await persistirDestilacao({ numero: 1, ano: 2026 }, tese, fazerDossie([trecho(), trecho()]));

    expect(r.herdados).toBe(0);
    expect(r.novos).toBe(3);
    const data = ultimoTx.teseDestilacao.create.mock.calls[0][0].data;
    expect(data.enunciados.create.every((e: { veredito: unknown }) => e.veredito === null)).toBe(true);
    expect(data.divergencias.create[0].veredito).toBeNull();
  });

  it('(b) enunciado identico herda o veredito; enunciado alterado NAO herda', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'anterior-id',
      enunciados: [
        { id: 'e1', enunciado: 'Texto A', veredito: 'aprovada', julgadoEm: diasAtras(10), julgadoPor: 'daniel' },
      ],
      divergencias: [],
    });
    const tese: TeseDestilada = {
      chave: '1/2026',
      assunto: 'Assunto',
      teses: [
        { enunciado: 'Texto A', inovacao: '', trechosFonte: [] },
        { enunciado: 'Texto A com uma virgula a mais', inovacao: '', trechosFonte: [] },
      ],
      sinaisQualitativos: [],
      divergencias: [],
      confianca: 'media',
    };

    const r = await persistirDestilacao({ numero: 1, ano: 2026 }, tese, fazerDossie([]));

    const enunciados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(enunciados[0].veredito).toBe('aprovada');
    expect(enunciados[0].herdadoDe).toBe('e1');
    expect(enunciados[1].veredito).toBeNull();
    expect(enunciados[1].herdadoDe).toBeNull();
    expect(r.herdados).toBe(1);
    expect(r.novos).toBe(1);
  });

  it('(c) divergencia e pareada pelo trecho de apoio, nao por origemChave/natureza', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'anterior-id',
      enunciados: [],
      divergencias: [
        {
          id: 'd1',
          trecho: 'trecho de suporte identico',
          veredito: 'procedente',
          julgadoEm: diasAtras(5),
          julgadoPor: 'daniel',
        },
      ],
    });
    const tese: TeseDestilada = {
      chave: '1/2026',
      assunto: 'Assunto',
      teses: [],
      sinaisQualitativos: [],
      divergencias: [
        {
          origemChave: '9/2026',
          precedenteApontado: '2/2020',
          trecho: 'trecho de suporte identico',
          natureza: 'natureza-diferente-nao-importa',
        },
      ],
      confianca: 'baixa',
    };

    const r = await persistirDestilacao({ numero: 1, ano: 2026 }, tese, fazerDossie([]));

    const divergencias = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.divergencias.create;
    expect(divergencias[0].veredito).toBe('procedente');
    expect(divergencias[0].herdadoDe).toBe('d1');
    expect(r.herdados).toBe(1);
    expect(r.novos).toBe(0);
  });

  it('(d) aritmetica de herdados/novos com mistura de enunciados e divergencias', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'anterior-id',
      enunciados: [{ id: 'e1', enunciado: 'A', veredito: 'aprovada', julgadoEm: diasAtras(1), julgadoPor: 'd' }],
      divergencias: [{ id: 'd1', trecho: 'X', veredito: 'procedente', julgadoEm: diasAtras(1), julgadoPor: 'd' }],
    });
    const tese: TeseDestilada = {
      chave: '1/2026',
      assunto: 'Assunto',
      teses: [
        { enunciado: 'A', inovacao: '', trechosFonte: [] }, // herda
        { enunciado: 'B nova', inovacao: '', trechosFonte: [] },
        { enunciado: 'C nova', inovacao: '', trechosFonte: [] },
      ],
      sinaisQualitativos: [],
      divergencias: [
        { origemChave: '1/2026', precedenteApontado: '2/2020', trecho: 'X', natureza: 'foo' }, // herda
        { origemChave: '3/2026', precedenteApontado: '4/2020', trecho: 'Y nova', natureza: 'foo' },
      ],
      confianca: 'alta',
    };

    const r = await persistirDestilacao({ numero: 1, ano: 2026 }, tese, fazerDossie([]));

    expect(r.herdados).toBe(2);
    expect(r.novos).toBe(3);
  });

  it('(d) com enunciados e divergencias vazios, herdados e novos ficam zerados', async () => {
    mockFindFirst.mockResolvedValue({ id: 'anterior-id', enunciados: [], divergencias: [] });
    const tese: TeseDestilada = {
      chave: '1/2026',
      assunto: '',
      teses: [],
      sinaisQualitativos: [],
      divergencias: [],
      confianca: 'baixa',
    };

    const r = await persistirDestilacao({ numero: 1, ano: 2026 }, tese, fazerDossie([]));

    expect(r.herdados).toBe(0);
    expect(r.novos).toBe(0);
  });

  it('(e) usa defaults quando assunto, confianca e sinaisQualitativos vem ausentes do parser', async () => {
    mockFindFirst.mockResolvedValue(null);
    // O parser (destilar-tese.ts) normalmente preenche esses defaults antes de
    // chegar aqui, mas persistirDestilacao nao deve confiar nisso.
    const teseIncompleta = { chave: '1/2026', teses: [], divergencias: [] } as unknown as TeseDestilada;

    await persistirDestilacao({ numero: 1, ano: 2026 }, teseIncompleta, fazerDossie([]));

    const data = ultimoTx.teseDestilacao.create.mock.calls[0][0].data;
    expect(data.assunto).toBe('');
    expect(data.confianca).toBe('baixa');
    expect(data.sinais).toEqual([]);
  });

  it('(f) desmarca a anterior DENTRO da transacao, condicional por (numeroAlvo, anoAlvo, atual) — nao por id fixo', async () => {
    mockFindFirst.mockResolvedValue({ id: 'anterior-id', enunciados: [], divergencias: [] });
    const tese: TeseDestilada = {
      chave: '7/2024',
      assunto: '',
      teses: [],
      sinaisQualitativos: [],
      divergencias: [],
      confianca: 'baixa',
    };

    await persistirDestilacao({ numero: 7, ano: 2024 }, tese, fazerDossie([]));

    expect(ultimoTx.teseDestilacao.updateMany).toHaveBeenCalledWith({
      where: { numeroAlvo: 7, anoAlvo: 2024, atual: true },
      data: { atual: false },
    });
    // A janela de corrida (cron + backfill sobre o mesmo alvo) so fecha se o
    // desmarcar for reavaliado no commit — nao pode ser um update fixado no
    // id de `anterior`, capturado fora da transacao.
    const whereChamado = ultimoTx.teseDestilacao.updateMany.mock.calls[0][0].where;
    expect(whereChamado).not.toHaveProperty('id');

    // Ordem: desmarcar acontece antes de criar, dentro da mesma transacao.
    const ordemUpdate = ultimoTx.teseDestilacao.updateMany.mock.invocationCallOrder[0];
    const ordemCreate = ultimoTx.teseDestilacao.create.mock.invocationCallOrder[0];
    expect(ordemUpdate).toBeLessThan(ordemCreate);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('selecionarElegiveis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(g) respeita o limite mesmo com mais candidatos elegiveis que o pedido', async () => {
    mockQueryRaw.mockResolvedValue([
      { numero: 1, ano: 2026, no_voto: 50 },
      { numero: 2, ano: 2026, no_voto: 40 },
      { numero: 3, ano: 2026, no_voto: 30 },
      { numero: 4, ano: 2026, no_voto: 20 },
      { numero: 5, ano: 2026, no_voto: 10 },
    ]);
    mockFindMany.mockResolvedValue([]); // nenhum tem versao atual -> todos elegiveis (>= MIN_NO_VOTO)

    const out = await selecionarElegiveis(2);

    expect(out).toHaveLength(2);
    expect(out.map((c) => c.numero)).toEqual([1, 2]);
  });

  it('retorna vazio quando nenhum candidato passa em ehElegivel', async () => {
    mockQueryRaw.mockResolvedValue([{ numero: 1, ano: 2026, no_voto: 5 }]);
    mockFindMany.mockResolvedValue([
      { numeroAlvo: 1, anoAlvo: 2026, dossieNoVoto: 100, criadoEm: diasAtras(1), versaoMotor: 1 },
    ]);

    const out = await selecionarElegiveis(10);

    expect(out).toHaveLength(0);
  });
});
