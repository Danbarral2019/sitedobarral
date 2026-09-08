import { describe, expect, it } from 'vitest';
import { resolveE2EDatabaseUrl } from '../../e2e/fixtures/database';

// As URLs abaixo não levam usuário nem senha de propósito: a função decide
// apenas pelo hostname, e credencial em URI de teste é lida por scanner de
// segredo como vazamento. Não "complete" estas URLs para deixá-las realistas.
describe('resolveE2EDatabaseUrl', () => {
  it('aceita banco remoto somente pela variável explícita de teste', () => {
    const url = 'postgresql://example.neon.tech/neondb';

    expect(resolveE2EDatabaseUrl({ TEST_DATABASE_URL: url })).toBe(url);
  });

  it('aceita DATABASE_URL local', () => {
    const url = 'postgresql://postgres:postgres@localhost:5432/barral_e2e';

    expect(resolveE2EDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it('recusa DATABASE_URL remota para evitar uso acidental de produção', () => {
    const url = 'postgresql://database.example.com/site';

    expect(() => resolveE2EDatabaseUrl({ DATABASE_URL: url })).toThrow(
      'banco remoto deve ser informado exclusivamente por TEST_DATABASE_URL',
    );
  });
});
