// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usaDriverLocal } from '../prisma-adapter';

describe('usaDriverLocal', () => {
  it('reconhece o banco de smoke do CI', () => {
    expect(usaDriverLocal('postgresql://postgres:postgres@127.0.0.1:5432/barral_e2e')).toBe(true);
  });

  it('reconhece o banco local de desenvolvimento', () => {
    expect(usaDriverLocal('postgresql://postgres@localhost:5432/profbarral')).toBe(true);
  });

  it('não desvia o banco da Neon, que é o de produção', () => {
    expect(usaDriverLocal('postgresql://projeto.neon.tech/neondb?sslmode=require')).toBe(false);
  });

  it('não decide nada sem DATABASE_URL nem com URL malformada', () => {
    expect(usaDriverLocal(undefined)).toBe(false);
    expect(usaDriverLocal('nao-e-uma-url')).toBe(false);
  });
});
