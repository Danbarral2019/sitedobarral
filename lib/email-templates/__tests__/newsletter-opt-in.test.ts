// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  UNSUBSCRIBE_URL_PLACEHOLDER,
  personalizeNewsletterHtml,
} from '../newsletter';
import { renderNewsletterConfirmationEmail } from '../newsletter-confirmation';

describe('personalizeNewsletterHtml', () => {
  it('troca todas as ocorrências e escapa nome e URL', () => {
    const html = `<p>{{NAME}}</p><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">x</a><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">y</a>`;
    const out = personalizeNewsletterHtml(html, {
      name: '<script>alert(1)</script>',
      unsubscribeUrl: 'https://site.test/cancelar-newsletter?token=a.b&x="1"',
    });
    expect(out).not.toContain(UNSUBSCRIBE_URL_PLACEHOLDER);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out.match(/token=a\.b&amp;x=&quot;1&quot;/g)).toHaveLength(2);
  });

  it('usa "Assinante" quando não há nome', () => {
    expect(personalizeNewsletterHtml('{{NAME}}', { name: null, unsubscribeUrl: 'u' })).toBe('Assinante');
  });
});

describe('renderNewsletterConfirmationEmail', () => {
  it('traz o link de confirmação e escapa o nome', () => {
    const { html, text } = renderNewsletterConfirmationEmail({
      name: '<b>Ana</b>',
      confirmUrl: 'https://site.test/confirmar-newsletter?token=abc.def',
      validForHours: 72,
    });
    expect(html).toContain('https://site.test/confirmar-newsletter?token=abc.def');
    expect(html).not.toContain('<b>Ana</b>');
    expect(html).toContain('72 horas');
    expect(text).toContain('https://site.test/confirmar-newsletter?token=abc.def');
  });
});
