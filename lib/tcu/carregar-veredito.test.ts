import { describe, it, expect } from 'vitest';
import { carregarVeredito } from './carregar-veredito';

const em = new Date('2026-07-20T12:00:00Z');
const anterior = (enunciado: string, veredito: string | null, id = 'a1') => ({
  id, enunciado, veredito, julgadoEm: veredito ? em : null, julgadoPor: veredito ? 'daniel' : null,
});

describe('carregarVeredito', () => {
  it('herda o veredito quando o texto e IDENTICO', () => {
    const r = carregarVeredito('A prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    // Shape completo de propósito: o fixture `anterior` não traz estado editorial,
    // então herdar o veredito também herda os defaults (publicado/vitrinePublica
    // false, sem retirada) — não só o veredito em si.
    expect(r).toEqual({
      veredito: 'fiel', herdadoDe: 'a1', julgadoEm: em, julgadoPor: 'daniel',
      publicado: false, vitrinePublica: false, retiradoEm: null, retiradoMotivo: null,
    });
  });

  it('NAO herda quando muda a pontuacao — redacao diferente e julgamento novo', () => {
    const r = carregarVeredito('A prescricao e de dez anos', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
    expect(r.herdadoDe).toBeNull();
  });

  it('NAO herda quando muda so o espacamento', () => {
    const r = carregarVeredito('A  prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
  });

  it('NAO herda quando muda so a caixa', () => {
    const r = carregarVeredito('a prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
  });

  it('herda veredito negativo tambem', () => {
    const r = carregarVeredito('Tese ruim.', [anterior('Tese ruim.', 'errada')]);
    expect(r.veredito).toBe('errada');
  });

  it('nao herda de um anterior que nunca foi julgado', () => {
    const r = carregarVeredito('Tese X.', [anterior('Tese X.', null)]);
    // Shape completo de propósito: sem par, o retorno é exatamente SEM_VEREDITO
    // — inclusive os quatro campos editoriais, todos em seu estado neutro.
    expect(r).toEqual({
      veredito: null, herdadoDe: null, julgadoEm: null, julgadoPor: null,
      publicado: false, vitrinePublica: false, retiradoEm: null, retiradoMotivo: null,
    });
  });

  it('acha o par correto entre varios anteriores', () => {
    const r = carregarVeredito('Segunda tese.', [
      anterior('Primeira tese.', 'fiel', 'a1'),
      anterior('Segunda tese.', 'imprecisa', 'a2'),
    ]);
    expect(r).toMatchObject({ veredito: 'imprecisa', herdadoDe: 'a2' });
  });

  it('sem anteriores, nasce sem veredito', () => {
    expect(carregarVeredito('Tese nova.', []).veredito).toBeNull();
  });

  it('com anteriores duplicados julgados, usa o primeiro', () => {
    const r = carregarVeredito('Tese.', [anterior('Tese.', 'fiel', 'a1'), anterior('Tese.', 'errada', 'a2')]);
    expect(r.herdadoDe).toBe('a1');
  });

  it('enunciado retirado SEM veredito não ressuscita na redestilacao', () => {
    // `retirar-teses.ts` retira todos os enunciados da chave, tenham veredito
    // ou não. Se a herança editorial dependesse do veredito, o par não seria
    // encontrado, `retiradoEm` seria zerado e a tese voltaria ao ar (spec §5).
    const retiradoEm = new Date('2026-09-01T10:00:00Z');
    const r = carregarVeredito('Tese fora de escopo.', [
      {
        ...anterior('Tese fora de escopo.', null, 'a1'),
        retiradoEm,
        retiradoMotivo: 'materia estranha ao escopo do site',
      },
    ]);
    expect(r.retiradoEm).toEqual(retiradoEm);
    expect(r.retiradoMotivo).toBe('materia estranha ao escopo do site');
    // O veredito continua exigindo anterior julgado — só o estado editorial vem.
    expect(r.veredito).toBeNull();
    expect(r.herdadoDe).toBeNull();
  });

  it('estado editorial de enunciado publicado sem veredito também é herdado', () => {
    const r = carregarVeredito('Tese X.', [
      { ...anterior('Tese X.', null, 'a1'), publicado: true, vitrinePublica: true },
    ]);
    expect(r).toMatchObject({ publicado: true, vitrinePublica: true, veredito: null });
  });

  it('texto diferente não herda retirada — enunciado novo volta a fila', () => {
    const r = carregarVeredito('Tese reescrita.', [
      {
        ...anterior('Tese fora de escopo.', null, 'a1'),
        retiradoEm: new Date('2026-09-01T10:00:00Z'),
        retiradoMotivo: 'materia estranha',
      },
    ]);
    expect(r.retiradoEm).toBeNull();
    expect(r.retiradoMotivo).toBeNull();
  });
});
