import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock o sendEmail antes de importar email.ts
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'fake' }, error: null }) },
  })),
}));

import { renderDouEditorialAlertEmail, sendDouEditorialAlert } from '../email';

describe('renderDouEditorialAlertEmail', () => {
  const sample = (overrides: Partial<Parameters<typeof renderDouEditorialAlertEmail>[0][number]> = {}) => ({
    id: 's1',
    title: 'Portaria SEGES nº 8/2026',
    score: 85,
    reason: 'Regulamenta art. 23 da Lei 14.133.',
    summary: 'Atualiza pesquisa de preços com painel mínimo de 3 fontes.',
    affects: ['Lei 14.133', 'contratos vigentes'],
    actType: 'portaria' as const,
    issuer: 'SEGES',
    publishDate: '03/05/2026',
    douUrl: 'https://www.in.gov.br/web/dou/-/portaria-seges-8',
    ambiguous: false,
    ...overrides,
  });

  it('renderiza HTML com título, resumo e link', () => {
    const html = renderDouEditorialAlertEmail([sample()]);
    expect(html).toContain('Portaria SEGES nº 8/2026');
    expect(html).toContain('Atualiza pesquisa de preços');
    expect(html).toContain('Regulamenta art. 23');
    expect(html).toContain('https://www.in.gov.br/web/dou/-/portaria-seges-8');
  });

  it('escapa HTML em campos do usuário pra evitar injection', () => {
    const html = renderDouEditorialAlertEmail([
      sample({ title: '<script>alert(1)</script>' }),
    ]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('limita a 15 cards e adiciona footer "...e mais N"', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      sample({ id: `s${i}`, title: `Norma ${i}` }),
    );
    const html = renderDouEditorialAlertEmail(items);
    expect((html.match(/Norma \d/g) || []).length).toBe(15);
    expect(html).toMatch(/e mais 5/);
  });

  it('exibe badge de ambíguo quando ambiguous=true', () => {
    const html = renderDouEditorialAlertEmail([sample({ score: 60, ambiguous: true })]);
    expect(html.toLowerCase()).toContain('ambíguo');
  });

  it('substitui URLs não-http(s) por # no link Ver DOU', () => {
    const html = renderDouEditorialAlertEmail([
      sample({ douUrl: 'javascript:alert(1)' }),
    ]);
    // The "Ver DOU" anchor must NOT carry a javascript: href
    expect(html).not.toContain('javascript:alert');
    expect(html).toMatch(/href="#"[^>]*>Ver DOU/);
  });

  it('usa a cor de score do tier intermediário (70-79)', () => {
    const html = renderDouEditorialAlertEmail([sample({ score: 75 })]);
    // Petróleo claro é a cor do tier 70-79 — distinta do petróleo do tier 80+
    expect(html).toContain('#3a5a73');
  });

  it('omite as tags de "afeta" quando affects está vazio ou ausente', () => {
    const vazio = renderDouEditorialAlertEmail([sample({ affects: [] })]);
    const ausente = renderDouEditorialAlertEmail([sample({ affects: undefined })]);
    // sem tags de afeta (o container só aparece quando há tags)
    expect(vazio).not.toContain('background:#e9d8b8;color:#8a6235;padding:3px 10px');
    expect(ausente).not.toContain('background:#e9d8b8;color:#8a6235;padding:3px 10px');
  });

  it('usa "ato" como fallback quando actType está ausente', () => {
    const html = renderDouEditorialAlertEmail([sample({ actType: undefined })]);
    expect(html.toLowerCase()).toContain('ato ·');
  });
});

describe('sendDouEditorialAlert', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = 'admin@test.local';
    process.env.RESEND_API_KEY = 'fake';
  });
  afterEach(() => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.RESEND_API_KEY;
  });

  it('retorna false sem disparar quando highlights vazio', async () => {
    const ok = await sendDouEditorialAlert([]);
    expect(ok).toBe(false);
  });
});
