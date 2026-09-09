// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { planejarBackfill, type GrupoDeVersoes } from './backfill-heranca';
import { selecionarReconferencia } from '../teses/reconferencia';

const em = new Date('2026-08-13T00:00:00Z');
const antecessorJulgado = {
  id: 'ant-1', enunciado: 'Antiga.', veredito: 'fiel',
  julgadoEm: em, julgadoPor: 'daniel',
  publicado: true, vitrinePublica: true, retiradoEm: null, retiradoMotivo: null,
};
const antecessorDeLote = { ...antecessorJulgado, id: 'ant-2', julgadoPor: 'danbarral:lote-confianca-alta' };

const grupo = (over: Partial<GrupoDeVersoes> = {}): GrupoDeVersoes => ({
  chave: '1441/2016',
  vigentes: [],
  anteriores: [antecessorJulgado],
  ...over,
});

describe('planejarBackfill', () => {
  // Primeiro movimento: os 3 acórdãos que sumiram (spec §7).
  it('herda para enunciado vigente SEM veredito', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-1', enunciado: 'Nova.', veredito: null, julgadoPor: null }],
    })]);
    expect(r.herdar).toEqual([
      { chave: '1441/2016', enunciadoId: 'novo-1', veredito: 'fiel', publicado: true, herdadoDe: 'ant-1' },
    ]);
    expect(r.marcar).toEqual([]);
  });

  // Segundo movimento: os 6 carimbados pelo lote (spec §7). Nada sai do ar —
  // o veredito de lote fica, e a pendencia torna visivel o que estava oculto.
  it('apenas marca quando o vigente ja tem veredito e o antecessor foi conferido', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-2', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'danbarral:lote-confianca-alta' }],
    })]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual([
      { chave: '1441/2016', enunciadoId: 'novo-2', herdadoDe: 'ant-1' },
    ]);
  });

  // O id gravado tem de ser o do antecessor CONFERIDO INDIVIDUALMENTE. Com o
  // id do lote, ou a fila derruba o cartao, ou a folha exibe "Aprovada por
  // danbarral:lote-confianca-alta" — um carimbo automatico assinando como
  // pessoa.
  it('marca apontando para o antecessor conferido, nao para o de lote', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-6', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'danbarral:lote-confianca-alta' }],
      // O de lote vem PRIMEIRO de proposito: `julgados[0]` seria ele.
      anteriores: [antecessorDeLote, antecessorJulgado],
    })]);
    expect(r.marcar).toEqual([
      { chave: '1441/2016', enunciadoId: 'novo-6', herdadoDe: 'ant-1' },
    ]);
  });

  // Antecessor de lote nao e conferencia individual: marcar seria ruido.
  it('nao marca quando o antecessor tambem era de lote', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-3', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'danbarral:lote-confianca-alta' }],
      anteriores: [antecessorDeLote],
    })]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual([]);
  });

  // Pedir reconferencia do que uma pessoa acabou de conferir e inventar
  // trabalho, e contradiz `dados-do-veredito.ts`, que zera a flag para dizer
  // exatamente "julgado".
  it('nao marca quando o proprio vigente ja foi conferido por uma pessoa', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-7', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'daniel' }],
    })]);
    expect(r.marcar).toEqual([]);
  });

  // O backfill nao pode inventar onde a regra da Task 1 se recusa a decidir.
  it('nao herda quando a versao anterior tem vereditos divergentes', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-4', enunciado: 'Nova.', veredito: null, julgadoPor: null }],
      anteriores: [antecessorJulgado, { ...antecessorJulgado, id: 'ant-3', veredito: 'errada' }],
    })]);
    expect(r.herdar).toEqual([]);
  });

  // Texto identico ja e tratado pela redestilacao (nivel 1); o backfill nao
  // tem o que fazer, e marcar seria pendencia falsa.
  it('ignora enunciado cujo texto e identico ao do antecessor', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-5', enunciado: 'Antiga.', veredito: 'fiel', julgadoPor: null }],
    })]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual([]);
  });
});

/**
 * O par completo, e a razão de ele existir: `planejarBackfill` testado
 * isoladamente aprovava um plano que a fila descartava em silêncio — cinco
 * revisões passaram por cima disso. Aqui a saída de um alimenta a entrada do
 * outro, que é como os dois se encontram em produção.
 */
describe('planejarBackfill — o que o plano grava chega mesmo a fila', () => {
  function aplicarNaFila(
    plano: ReturnType<typeof planejarBackfill>,
    enunciados: Array<{ id: string; enunciado: string }>,
    anteriores: typeof antecessorJulgado[]
  ) {
    // Simula o banco depois da escrita do script: cada movimento grava
    // `reconferenciaPendente` E `herdadoDe` na linha que nomeia.
    const gravado = new Map<string, { reconferenciaPendente: boolean; herdadoDe: string | null }>();
    for (const h of plano.herdar) gravado.set(h.enunciadoId, { reconferenciaPendente: true, herdadoDe: h.herdadoDe });
    for (const m of plano.marcar) gravado.set(m.enunciadoId, { reconferenciaPendente: true, herdadoDe: m.herdadoDe });

    return selecionarReconferencia(
      [{
        chave: '1441/2016',
        enunciados: enunciados.map((e) => ({
          id: e.id,
          enunciado: e.enunciado,
          reconferenciaPendente: gravado.get(e.id)?.reconferenciaPendente ?? false,
          herdadoDe: gravado.get(e.id)?.herdadoDe ?? null,
        })),
      }],
      new Map(anteriores.map((a) => [a.id, { enunciado: a.enunciado, julgadoPor: a.julgadoPor, julgadoEm: a.julgadoEm }]))
    );
  }

  it('o 2o movimento produz um cartao visivel, com o texto e a autoria certos', () => {
    const vigente = { id: 'novo-2', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'danbarral:lote-confianca-alta' };
    const plano = planejarBackfill([grupo({ vigentes: [vigente] })]);

    const fila = aplicarNaFila(plano, [vigente], [antecessorJulgado]);
    expect(fila).toHaveLength(1);
    expect(fila[0].enunciadoNovo).toBe('Nova.');
    expect(fila[0].enunciadoAnterior).toBe('Antiga.');
    expect(fila[0].julgadoPor).toBe('daniel');
  });

  it('o 1o movimento tambem chega a fila', () => {
    const vigente = { id: 'novo-1', enunciado: 'Nova.', veredito: null, julgadoPor: null };
    const plano = planejarBackfill([grupo({ vigentes: [vigente] })]);

    const fila = aplicarNaFila(plano, [vigente], [antecessorJulgado]);
    expect(fila).toHaveLength(1);
    expect(fila[0].julgadoPor).toBe('daniel');
  });

  it('a marca nunca atribui a uma pessoa um carimbo de lote', () => {
    const vigente = { id: 'novo-6', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'danbarral:lote-confianca-alta' };
    const plano = planejarBackfill([grupo({
      vigentes: [vigente],
      anteriores: [antecessorDeLote, antecessorJulgado],
    })]);

    const fila = aplicarNaFila(plano, [vigente], [antecessorDeLote, antecessorJulgado]);
    expect(fila).toHaveLength(1);
    expect(fila[0].julgadoPor).toBe('daniel');
  });
});
