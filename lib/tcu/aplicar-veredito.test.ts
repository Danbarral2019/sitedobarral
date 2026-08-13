import { describe, it, expect } from 'vitest';
import { resolverAlvoDivergencia } from './aplicar-veredito';

describe('resolverAlvoDivergencia', () => {
  it('resolve pelo campo ordem, não pela posição no array', () => {
    // O banco pode devolver as linhas em qualquer ordem; é `ordem` que diz
    // qual card o Daniel viu.
    const divergencias = [
      { id: 'segunda', ordem: 1 },
      { id: 'primeira', ordem: 0 },
    ];

    expect(resolverAlvoDivergencia(0, divergencias)).toEqual({ id: 'primeira' });
    expect(resolverAlvoDivergencia(1, divergencias)).toEqual({ id: 'segunda' });
  });

  it('resolve a única divergência de uma destilação', () => {
    expect(resolverAlvoDivergencia(0, [{ id: 'div-a', ordem: 0 }])).toEqual({ id: 'div-a' });
  });

  it('recusa quando nenhuma divergência tem a ordem pedida', () => {
    const out = resolverAlvoDivergencia(1, [{ id: 'div-a', ordem: 0 }]);

    expect(out).toEqual({ recusa: 'a destilação não tem divergência de ordem 2 (tem 1)' });
  });

  it('recusa quando duas divergências dividem a mesma ordem', () => {
    const out = resolverAlvoDivergencia(0, [
      { id: 'div-a', ordem: 0 },
      { id: 'div-b', ordem: 0 },
    ]);

    expect(out).toEqual({
      recusa: 'duas divergências gravadas com ordem 1 — dado inconsistente, não dá para saber qual foi julgada',
    });
  });

  it('recusa quando a destilação não tem divergência nenhuma', () => {
    expect(resolverAlvoDivergencia(0, [])).toEqual({
      recusa: 'a destilação não tem divergência de ordem 1 (tem 0)',
    });
  });
});
