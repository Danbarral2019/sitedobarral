import { describe, it, expect } from 'vitest';
import { CATEGORIAS_ACORDAO } from './categorias';
import { CATEGORIA_GRAFO } from './backfill-retroativo';

describe('CATEGORIAS_ACORDAO', () => {
  it('cobre o acervo curado e o combustivel do grafo', () => {
    expect([...CATEGORIAS_ACORDAO]).toEqual(['acordao', 'acordao-grafo']);
  });
  it('inclui exatamente a categoria que o backfill grava', () => {
    expect([...CATEGORIAS_ACORDAO]).toContain(CATEGORIA_GRAFO);
  });
});
