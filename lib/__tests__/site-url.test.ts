import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSiteUrl } from '@/lib/site-url';

describe('getSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('normaliza a origem como URL absoluta', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://www.exemplo.com/caminho?origem=teste');

    expect(getSiteUrl().toString()).toBe('https://www.exemplo.com/');
  });

  it('rejeita protocolo não HTTPS em produção', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://www.exemplo.com');

    expect(() => getSiteUrl()).toThrow(
      'NEXT_PUBLIC_BASE_URL deve usar HTTPS em produção.',
    );
  });

  it('exige a variável no ambiente de produção', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');

    expect(() => getSiteUrl()).toThrow(
      'NEXT_PUBLIC_BASE_URL deve ser configurada em produção.',
    );
  });

  it('usa localhost apenas fora de produção', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');

    expect(getSiteUrl().toString()).toBe('http://localhost:3000/');
  });
});
