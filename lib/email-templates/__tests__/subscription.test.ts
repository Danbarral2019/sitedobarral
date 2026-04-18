import { describe, it, expect } from 'vitest';
import {
  renderWelcomeEmail,
  renderReceiptEmail,
  renderCardFailedEmail,
  renderPixMandateFailedEmail,
  renderCanceledEmail,
} from '../subscription';

describe('subscription email templates', () => {
  describe('renderWelcomeEmail', () => {
    it('gera subject, html e text com nome, plano e CTA para área restrita', () => {
      const r = renderWelcomeEmail({
        name: 'Fulano',
        plan: 'premium',
        billingCycle: 'monthly',
      });
      expect(r.subject).toMatch(/Premium/);
      expect(r.html).toContain('Fulano');
      expect(r.html).toContain('Premium');
      expect(r.html).toContain('/area-restrita');
      expect(r.text).toContain('Fulano');
      expect(r.text).toContain('/area-restrita');
    });

    it('funciona sem nome', () => {
      const r = renderWelcomeEmail({ name: '', plan: 'basico', billingCycle: 'yearly' });
      expect(r.subject).toMatch(/B[aá]sico/);
      expect(r.html).toContain('anual');
      expect(r.text).toContain('anual');
    });

    it('escapa html no nome para evitar injeção', () => {
      const r = renderWelcomeEmail({
        name: '<script>alert(1)</script>',
        plan: 'premium',
        billingCycle: 'monthly',
      });
      expect(r.html).not.toContain('<script>');
      expect(r.html).toContain('&lt;script&gt;');
    });
  });

  describe('renderReceiptEmail', () => {
    it('formata valor em BRL e data em pt-BR', () => {
      const r = renderReceiptEmail({
        name: 'Maria',
        plan: 'premium',
        billingCycle: 'monthly',
        nextBillingDate: new Date('2026-05-15T12:00:00Z'),
        amountPaidCents: 4990,
        currency: 'brl',
        invoiceUrl: 'https://stripe.example/invoice/abc',
      });
      expect(r.subject).toContain('R$');
      expect(r.html).toContain('R$');
      expect(r.html).toContain('49,90');
      expect(r.html).toMatch(/maio/i);
      expect(r.html).toContain('https://stripe.example/invoice/abc');
      expect(r.text).toContain('49,90');
      expect(r.text).toContain('https://stripe.example/invoice/abc');
    });

    it('omite link de fatura quando invoiceUrl ausente', () => {
      const r = renderReceiptEmail({
        name: 'Maria',
        plan: 'basico',
        billingCycle: 'yearly',
        nextBillingDate: new Date('2026-12-01T12:00:00Z'),
        amountPaidCents: 29990,
        currency: 'brl',
        invoiceUrl: null,
      });
      expect(r.html).not.toContain('Ver a fatura');
    });
  });

  describe('renderCardFailedEmail', () => {
    it('inclui billingPortalUrl como CTA', () => {
      const url = 'https://billing.stripe.com/session/xyz';
      const r = renderCardFailedEmail({ name: 'João', billingPortalUrl: url });
      expect(r.subject.toLowerCase()).toContain('falha');
      expect(r.html).toContain(url);
      expect(r.text).toContain(url);
      expect(r.html).toContain('João');
    });
  });

  describe('renderPixMandateFailedEmail', () => {
    it('inclui billingPortalUrl como CTA e menciona Pix', () => {
      const url = 'https://billing.stripe.com/session/pix';
      const r = renderPixMandateFailedEmail({ name: 'Ana', billingPortalUrl: url });
      expect(r.subject).toMatch(/Pix/i);
      expect(r.html).toContain(url);
      expect(r.html).toMatch(/Pix/i);
      expect(r.text).toContain(url);
    });
  });

  describe('renderCanceledEmail', () => {
    it('menciona data de fim do acesso quando fornecida', () => {
      const r = renderCanceledEmail({
        name: 'Carlos',
        accessEndsAt: new Date('2026-06-10T12:00:00Z'),
      });
      expect(r.subject.toLowerCase()).toContain('cancelamento');
      expect(r.html).toMatch(/junho/i);
      expect(r.text).toMatch(/junho/i);
    });

    it('funciona sem data de fim de acesso', () => {
      const r = renderCanceledEmail({ name: 'Carlos', accessEndsAt: null });
      expect(r.subject.toLowerCase()).toContain('cancelamento');
      expect(r.html).toContain('encerrado');
      expect(r.text).toContain('encerrado');
    });
  });

  describe('shell integration', () => {
    it('todos os templates incluem o nome da marca no footer', () => {
      const templates = [
        renderWelcomeEmail({ name: 'X', plan: 'premium', billingCycle: 'monthly' }).html,
        renderReceiptEmail({
          name: 'X',
          plan: 'premium',
          billingCycle: 'monthly',
          nextBillingDate: new Date(),
          amountPaidCents: 1000,
          currency: 'brl',
        }).html,
        renderCardFailedEmail({ name: 'X', billingPortalUrl: 'https://x' }).html,
        renderPixMandateFailedEmail({ name: 'X', billingPortalUrl: 'https://x' }).html,
        renderCanceledEmail({ name: 'X', accessEndsAt: null }).html,
      ];
      for (const html of templates) {
        expect(html).toContain('Prof. Daniel Barral');
        expect(html).toContain('<!DOCTYPE html>');
      }
    });
  });
});
