import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TeseDestilada } from './destilar-tese';
import type { DossieUso, TrechoCitacao } from './trechos-de-citacao';

const { mockAnterior, mockFindMany, mockTransaction, mockQueryRaw, mockDocs } = vi.hoisted(() => ({
  mockAnterior: vi.fn(),
  mockFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockDocs: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teseDestilacao: {
      findFirst: (...a: unknown[]) => mockAnterior(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
    document: { findMany: (...a: unknown[]) => mockDocs(...a) },
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
    mockDocs.mockResolvedValue([]);
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
    mockAnterior.mockResolvedValue(null);
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
    mockAnterior.mockResolvedValue({
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
    mockAnterior.mockResolvedValue({
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
    mockAnterior.mockResolvedValue({
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
    mockAnterior.mockResolvedValue({ id: 'anterior-id', enunciados: [], divergencias: [] });
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
    mockAnterior.mockResolvedValue(null);
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
    mockAnterior.mockResolvedValue({ id: 'anterior-id', enunciados: [], divergencias: [] });
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

  it('grava os trechos citados junto da destilação, resolvidos pelo dossiê em mãos', async () => {
    // Precisa de um caminho para o inteiro teor (invariante da spec §7.1) —
    // sem isso o trecho referenciado (índice 1) seria zerado, e este teste
    // deixaria de testar só a resolução de índice, que é seu objetivo aqui.
    mockDocs.mockResolvedValue([
      { id: 'doc-200', acordaoNumero: 200, acordaoAno: 2021, tcuOrgaoJulgador: 'Plenário', url: 'https://u/200', tcuLinkPDF: 'https://p/200' },
    ]);
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 2, noVoto: 2, ocorrenciasTotal: 2 },
      trechos: [
        { origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'primeiro', offset: 0 },
        { origemChave: '200/2021', secao: 'voto' as const, noVoto: true, trecho: 'segundo', offset: 0 },
      ],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { chave: '1441/2016', assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [1] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    const trechos = criados[0].trechos.create;
    expect(trechos).toHaveLength(1);
    // trechosFonte: [1] → o SEGUNDO trecho do dossiê
    expect(trechos[0]).toMatchObject({
      ordem: 1, trecho: 'segundo', origemNumero: 200, origemAno: 2021, noVoto: true,
    });
  });

  it('não grava evidência parcial: índice fora do dossiê zera os trechos do enunciado', async () => {
    // Documento casando com o trecho 0: se faltasse, a invariante de caminho
    // para o inteiro teor já zeraria o resultado ali, e o teste passaria por
    // acaso sem nunca avaliar o índice 7 (fora de alcance), que é o que ele
    // se propõe a provar.
    mockDocs.mockResolvedValue([
      { id: 'doc-100', acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: 'Plenário', url: 'https://u/100', tcuLinkPDF: 'https://p/100' },
    ]);
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 1, noVoto: 1, ocorrenciasTotal: 1 },
      trechos: [{ origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'unico', offset: 0 }],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { chave: '1441/2016', assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [0, 7] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(criados[0].trechos.create).toEqual([]);
  });

  it('copia o caminho para o inteiro teor do citante', async () => {
    mockDocs.mockResolvedValue([
      { id: 'doc-100', acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: 'Plenário', url: 'https://u/100', tcuLinkPDF: 'https://p/100' },
    ]);
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 1, noVoto: 1, ocorrenciasTotal: 1 },
      trechos: [{ origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'unico', offset: 0 }],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { chave: '1441/2016', assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [0] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(criados[0].trechos.create[0]).toMatchObject({
      origemDocumentId: 'doc-100', origemUrl: 'https://u/100', origemLinkPDF: 'https://p/100',
    });
  });

  it('resolve o citante pelo id do trecho quando dois Document dividem número e ano', async () => {
    // C1: `(acordaoNumero, acordaoAno)` não identifica um acórdão do TCU — o
    // schema declara a unicidade em (numero, ano, tcuOrgaoJulgador). Resolver
    // pela chave gravaria a procedência de um colegiado arbitrário, e de forma
    // não-determinística (o último de um findMany). O trecho carrega o id do
    // Document cujo texto o produziu, e é ele que decide.
    mockDocs.mockResolvedValue([
      { id: 'doc-plenario', acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: 'Plenário', url: 'https://u/plenario', tcuLinkPDF: 'https://p/plenario' },
      { id: 'doc-camara', acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: 'Primeira Câmara', url: 'https://u/camara', tcuLinkPDF: 'https://p/camara' },
    ]);
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 1, noVoto: 1, ocorrenciasTotal: 1 },
      trechos: [{
        origemChave: '100/2020', origemDocumentId: 'doc-camara',
        secao: 'voto' as const, noVoto: true, trecho: 'unico', offset: 0,
      }],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { chave: '1441/2016', assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [0] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    // A consulta é por id, e não pelo par número+ano.
    expect(mockDocs.mock.calls[0][0].where.OR).toContainEqual({ id: { in: ['doc-camara'] } });
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(criados[0].trechos.create[0]).toMatchObject({
      origemDocumentId: 'doc-camara',
      origemColegiado: 'Primeira Câmara',
      origemUrl: 'https://u/camara',
      origemLinkPDF: 'https://p/camara',
    });
  });

  it('citante ausente da base zera os trechos — evidência sem caminho não é gravada', async () => {
    mockDocs.mockResolvedValue([]);
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 1, noVoto: 1, ocorrenciasTotal: 1 },
      trechos: [{ origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'unico', offset: 0 }],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { chave: '1441/2016', assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [0] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(criados[0].trechos.create).toEqual([]);
  });

  it('grava a identidade oficial quando fornecida', async () => {
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { chave: '1441/2016', assunto: 'x', confianca: 'alta', teses: [], divergencias: [], sinaisQualitativos: [] },
      { alvo: { numero: 1441, ano: 2016 }, contagem: { citantesDistintos: 0, noVoto: 0, ocorrenciasTotal: 0 }, trechos: [] },
      { acordaoKey: 'ACORDAO-COMPLETO-9', colegiadoAlvo: 'Plenário', relatorAlvo: 'Rel', urlAlvo: 'https://x' },
    );
    const data = ultimoTx.teseDestilacao.create.mock.calls[0][0].data;
    expect(data.acordaoKey).toBe('ACORDAO-COMPLETO-9');
    expect(data.colegiadoAlvo).toBe('Plenário');
  });

  it('herda a retirada em texto idêntico — tese retirada não ressuscita', async () => {
    mockAnterior.mockResolvedValue({
      id: 'ant', enunciados: [{
        id: 'e-ant', enunciado: 'E1', veredito: 'fiel',
        julgadoEm: new Date('2026-08-01'), julgadoPor: 'daniel',
        publicado: true, vitrinePublica: true,
        retiradoEm: new Date('2026-08-20'), retiradoMotivo: 'matéria de pessoal',
      }],
      divergencias: [],
    });
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { chave: '1441/2016', assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [] }], divergencias: [], sinaisQualitativos: [] },
      { alvo: { numero: 1441, ano: 2016 }, contagem: { citantesDistintos: 0, noVoto: 0, ocorrenciasTotal: 0 }, trechos: [] },
    );
    const criado = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create[0];
    expect(criado.retiradoEm).toEqual(new Date('2026-08-20'));
    expect(criado.retiradoMotivo).toBe('matéria de pessoal');
    expect(criado.publicado).toBe(true);
    expect(criado.vitrinePublica).toBe(true);
  });

  it('texto alterado não herda nada — volta à fila de julgamento', async () => {
    mockAnterior.mockResolvedValue({
      id: 'ant', enunciados: [{
        id: 'e-ant', enunciado: 'TEXTO ANTIGO', veredito: 'fiel',
        julgadoEm: new Date('2026-08-01'), julgadoPor: 'daniel',
        publicado: true, vitrinePublica: true, retiradoEm: null, retiradoMotivo: null,
      }],
      divergencias: [],
    });
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { chave: '1441/2016', assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'TEXTO NOVO', inovacao: 'i', trechosFonte: [] }], divergencias: [], sinaisQualitativos: [] },
      { alvo: { numero: 1441, ano: 2016 }, contagem: { citantesDistintos: 0, noVoto: 0, ocorrenciasTotal: 0 }, trechos: [] },
    );
    const criado = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create[0];
    expect(criado.veredito).toBeNull();
    expect(criado.publicado).toBe(false);
    expect(criado.vitrinePublica).toBe(false);
    expect(criado.retiradoEm).toBeNull();
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

  // A onda A-W2 destila primeiro as faixas mais fortes (>=10 no voto). O limiar
  // precisa viajar ate o SQL: filtrar so em memoria traria o acervo inteiro do
  // grafo para descartar a maior parte dele.
  it('repassa o limiar recebido para o HAVING da consulta ao grafo', async () => {
    mockQueryRaw.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    await selecionarElegiveis(500, 10);

    expect(mockQueryRaw.mock.calls[0][1]).toBe(10);
  });

  it('usa MIN_NO_VOTO quando o limiar nao e informado — o cron diario nao muda', async () => {
    mockQueryRaw.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    await selecionarElegiveis(5);

    expect(mockQueryRaw.mock.calls[0][1]).toBe(MIN_NO_VOTO);
  });

  it('nao destila caso abaixo do limiar elevado que o SQL por engano devolveu', async () => {
    mockQueryRaw.mockResolvedValue([
      { numero: 1, ano: 2026, no_voto: 12 },
      { numero: 2, ano: 2026, no_voto: 7 },
    ]);
    mockFindMany.mockResolvedValue([]);

    const out = await selecionarElegiveis(10, 10);

    expect(out.map((c) => c.numero)).toEqual([1]);
  });
});

describe('ehElegivel — limiar informado pelo chamador', () => {
  it('NAO entra com 9 quando o limiar e 10', () => expect(ehElegivel(9, null, agora, 10)).toBe(false));
  it('entra com exatamente 10 quando o limiar e 10', () => expect(ehElegivel(10, null, agora, 10)).toBe(true));
  it('o limiar elevado nao afeta a regra de redestilacao', () =>
    expect(ehElegivel(15, { dossieNoVoto: 10, criadoEm: diasAtras(8) }, agora, 10)).toBe(true));
});
