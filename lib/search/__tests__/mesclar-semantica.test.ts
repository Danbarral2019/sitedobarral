// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mesclarSemDuplicar, contarNovos } from '../mesclar-semantica';

const d = (id: string) => ({ id });

describe('mesclarSemDuplicar', () => {
  it('mantém a ordem do full-text no topo', () => {
    const out = mesclarSemDuplicar([d('a'), d('b')], [d('x'), d('y')], 10);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'x', 'y']);
  });

  it('não repete documento que já veio do full-text', () => {
    const out = mesclarSemDuplicar([d('a'), d('b')], [d('b'), d('c')], 10);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('respeita o limite total, não o de cada lista', () => {
    const out = mesclarSemDuplicar([d('a'), d('b'), d('c')], [d('x'), d('y')], 4);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c', 'x']);
  });

  // O caso que motivou o item: full-text não acha nada para linguagem natural.
  it('devolve só os semânticos quando o full-text não achou nada', () => {
    const out = mesclarSemDuplicar([], [d('x'), d('y')], 10);
    expect(out.map((x) => x.id)).toEqual(['x', 'y']);
  });

  it('devolve só os textuais quando a semântica falhou', () => {
    const out = mesclarSemDuplicar([d('a')], [], 10);
    expect(out.map((x) => x.id)).toEqual(['a']);
  });

  it('não altera os arrays recebidos', () => {
    const textuais = [d('a')];
    const semanticos = [d('x')];
    mesclarSemDuplicar(textuais, semanticos, 10);
    expect(textuais).toHaveLength(1);
    expect(semanticos).toHaveLength(1);
  });
});

describe('contarNovos', () => {
  it('conta só o que a semântica acrescentou', () => {
    expect(contarNovos([d('a'), d('b')], [d('b'), d('c'), d('e')])).toBe(2);
  });

  it('é zero quando a semântica não trouxe nada de novo', () => {
    expect(contarNovos([d('a'), d('b')], [d('a'), d('b')])).toBe(0);
  });
});
