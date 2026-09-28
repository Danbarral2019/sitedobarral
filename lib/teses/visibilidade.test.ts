// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { visibilidadeDasTeses } from './visibilidade';

describe('visibilidadeDasTeses', () => {
  it('dá acervo a quem tem acesso ativo', () => {
    expect(visibilidadeDasTeses(true)).toBe('acervo');
  });

  it('dá vitrine a visitante e a autenticado sem acesso', () => {
    expect(visibilidadeDasTeses(false)).toBe('vitrine');
  });
});
