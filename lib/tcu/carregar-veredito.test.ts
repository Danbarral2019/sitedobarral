import { describe, it, expect } from 'vitest';
import { carregarVeredito } from './carregar-veredito';

const em = new Date('2026-07-20T12:00:00Z');
const anterior = (enunciado: string, veredito: string | null, id = 'a1') => ({
  id, enunciado, veredito, julgadoEm: veredito ? em : null, julgadoPor: veredito ? 'daniel' : null,
});

describe('carregarVeredito', () => {
  it('herda o veredito quando o texto e IDENTICO', () => {
    const r = carregarVeredito('A prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r).toEqual({ veredito: 'fiel', herdadoDe: 'a1', julgadoEm: em, julgadoPor: 'daniel' });
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
    expect(r).toEqual({ veredito: null, herdadoDe: null, julgadoEm: null, julgadoPor: null });
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
});
