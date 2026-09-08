// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnunciados } = vi.hoisted(() => ({ mockEnunciados: vi.fn() }));
vi.mock('../prisma', () => ({
  prisma: { teseEnunciado: { findMany: (...a: unknown[]) => mockEnunciados(...a) } },
}));

import { selecionarParaPublicar } from './publicar-acervo';

const trechoOk = { ordem: 0, origemDocumentId: 'd1', origemUrl: null, origemLinkPDF: null };

/** Enunciado como volta da consulta de INCLUSÃO (predicado canônico no SQL). */
const enunciado = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  trechosFonte: [0],
  trechos: [trechoOk],
  ...over,
});

/** Enunciado como volta da consulta de RELATÓRIO (`{ publicado: false }` puro). */
const naoPublicado = (over: Record<string, unknown> = {}) => ({
  id: 'x1',
  veredito: 'fiel',
  retiradoEm: null,
  destilacao: { atual: true },
  trechosFonte: [0],
  trechos: [trechoOk],
  ...over,
});

/**
 * A função faz DUAS consultas: a de inclusão (canônica) e a de relatório
 * (larga). Os mocks são posicionais, na ordem em que o código as emite.
 */
function mockarConsultas(
  candidatos: ReturnType<typeof enunciado>[],
  naoPublicados: ReturnType<typeof naoPublicado>[],
) {
  mockEnunciados.mockResolvedValueOnce(candidatos).mockResolvedValueOnce(naoPublicados);
}

describe('selecionarParaPublicar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta usando o predicado canônico e publicado false', async () => {
    mockarConsultas([], []);
    await selecionarParaPublicar();
    // A PRIMEIRA consulta é a que define o conjunto de inclusão, e ela tem de
    // continuar saindo de WHERE_ELEGIVEL_BASE. É esta asserção que impede o
    // predicado de virar duas definições concorrentes.
    const where = mockEnunciados.mock.calls[0][0].where;
    expect(where.veredito).toBe('fiel');
    expect(where.retiradoEm).toBeNull();
    expect(where.destilacao).toEqual({ atual: true });
    expect(where.publicado).toBe(false);
  });

  it('a consulta de relatório é larga: só publicado false, sem NOT', async () => {
    mockarConsultas([], []);
    await selecionarParaPublicar();
    // `NOT: WHERE_ELEGIVEL_BASE` vira `NOT (...)` em SQL e a lógica de três
    // valores do Postgres descartaria as linhas com `veredito` NULL — que são
    // justamente um dos motivos que se quer contar.
    expect(mockEnunciados.mock.calls[1][0].where).toEqual({ publicado: false });
  });

  it('publica o enunciado com evidência íntegra', async () => {
    mockarConsultas([enunciado()], [naoPublicado({ id: 'e1' })]);
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual(['e1']);
    // Já contabilizado na inclusão: a segunda passagem não pode recontá-lo.
    expect(r.foraPorMotivo).toEqual({});
  });

  it('exclui evidência incompleta e conta o motivo', async () => {
    // declara dois índices, só um persistido
    const e = enunciado({ trechosFonte: [0, 1] });
    mockarConsultas([e], [naoPublicado({ id: 'e1', trechosFonte: [0, 1] })]);
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual([]);
    expect(r.foraPorMotivo['evidência incompleta']).toBe(1);
  });

  it('exclui trecho sem caminho para o inteiro teor', async () => {
    const semCaminho = { ordem: 0, origemDocumentId: null, origemUrl: null, origemLinkPDF: null };
    mockarConsultas(
      [enunciado({ trechos: [semCaminho] })],
      [naoPublicado({ id: 'e1', trechos: [semCaminho] })],
    );
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual([]);
    expect(r.foraPorMotivo['evidência incompleta']).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Os motivos que o filtro SQL da consulta de inclusão remove antes de chegar
  // ao contador (spec §10.1). Um por vez, para que a classificação em memória
  // seja verificada isoladamente.
  // -------------------------------------------------------------------------

  it('conta versão superada', async () => {
    mockarConsultas([], [naoPublicado({ destilacao: { atual: false } })]);
    const r = await selecionarParaPublicar();
    expect(r.foraPorMotivo).toEqual({ 'versão superada': 1 });
  });

  it('conta retirada editorial', async () => {
    mockarConsultas([], [naoPublicado({ retiradoEm: new Date('2026-09-01') })]);
    const r = await selecionarParaPublicar();
    expect(r.foraPorMotivo).toEqual({ 'retirada editorial': 1 });
  });

  it('conta veredito ausente', async () => {
    mockarConsultas([], [naoPublicado({ veredito: null })]);
    const r = await selecionarParaPublicar();
    expect(r.foraPorMotivo).toEqual({ 'veredito ausente ou reprovado': 1 });
  });

  it('conta veredito reprovado', async () => {
    mockarConsultas([], [naoPublicado({ veredito: 'imprecisa' })]);
    const r = await selecionarParaPublicar();
    expect(r.foraPorMotivo).toEqual({ 'veredito ausente ou reprovado': 1 });
  });

  it('conta como evidência incompleta quem não tem trecho algum', async () => {
    // Excluído no SQL pelo `trechos: { some: {} }`, então só a segunda
    // consulta o vê. Cai no mesmo balde da evidência conferida em memória.
    mockarConsultas([], [naoPublicado({ trechosFonte: [], trechos: [] })]);
    const r = await selecionarParaPublicar();
    expect(r.foraPorMotivo).toEqual({ 'evidência incompleta': 1 });
  });

  it('atribui um motivo só, na ordem documentada, quando vários se aplicam', async () => {
    // Superada E retirada E reprovada E sem evidência: a precedência vai do
    // mais abrangente para o mais específico, então conta como superada.
    mockarConsultas([], [
      naoPublicado({
        destilacao: { atual: false },
        retiradoEm: new Date('2026-09-01'),
        veredito: 'errada',
        trechosFonte: [],
        trechos: [],
      }),
    ]);
    const r = await selecionarParaPublicar();
    expect(r.foraPorMotivo).toEqual({ 'versão superada': 1 });
  });

  it('o balde de deriva fica em zero no caminho feliz', async () => {
    // Detector: se WHERE_ELEGIVEL_BASE ganhar uma cláusula que a classificação
    // em memória não espelha, o enunciado excluído por ela cai aqui.
    mockarConsultas(
      [enunciado()],
      [naoPublicado({ id: 'e1' }), naoPublicado({ id: 'x2', veredito: 'errada' })],
    );
    const r = await selecionarParaPublicar();
    expect(r.foraPorMotivo['inelegível por motivo não classificado']).toBeUndefined();
  });

  it('agrega os motivos de vários enunciados', async () => {
    mockarConsultas([], [
      naoPublicado({ id: 'a', destilacao: { atual: false } }),
      naoPublicado({ id: 'b', destilacao: { atual: false } }),
      naoPublicado({ id: 'c', veredito: null }),
      naoPublicado({ id: 'd', retiradoEm: new Date('2026-09-01') }),
    ]);
    const r = await selecionarParaPublicar();
    expect(r.foraPorMotivo).toEqual({
      'versão superada': 2,
      'veredito ausente ou reprovado': 1,
      'retirada editorial': 1,
    });
  });
});
