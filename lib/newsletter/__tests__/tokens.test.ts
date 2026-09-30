// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CONFIRMATION_TOKEN_TTL_SECONDS,
  signConfirmationToken,
  signUnsubscribeToken,
  verifyConfirmationToken,
  verifyUnsubscribeToken,
} from '../tokens';

const ID = '4f1c2b7e-8d0a-4a35-9b6e-1c2d3e4f5a6b';

function tamperSignature(token: string): string {
  const [payload, sig] = token.split('.');
  const last = sig.slice(-1) === 'A' ? 'B' : 'A';
  return `${payload}.${sig.slice(0, -1)}${last}`;
}

function tamperPayload(token: string, newId: string): string {
  const [, sig] = token.split('.');
  const payload = Buffer.from(JSON.stringify({ s: newId, e: 9999999999 }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${payload}.${sig}`;
}

describe('tokens da newsletter', () => {
  const originalSecret = process.env.NEWSLETTER_TOKEN_SECRET;

  beforeEach(() => {
    delete process.env.NEWSLETTER_TOKEN_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.NEWSLETTER_TOKEN_SECRET;
    else process.env.NEWSLETTER_TOKEN_SECRET = originalSecret;
  });

  describe('confirmação', () => {
    it('aceita token válido dentro do prazo', () => {
      const token = signConfirmationToken(ID);
      expect(verifyConfirmationToken(token)).toEqual({ ok: true, subscriberId: ID });
    });

    it('recusa token expirado', () => {
      const emitido = new Date('2026-09-01T12:00:00Z');
      const token = signConfirmationToken(ID, emitido);
      const depoisDoPrazo = new Date(emitido.getTime() + (CONFIRMATION_TOKEN_TTL_SECONDS + 1) * 1000);
      expect(verifyConfirmationToken(token, depoisDoPrazo)).toEqual({ ok: false, reason: 'expired' });

      const noPrazo = new Date(emitido.getTime() + (CONFIRMATION_TOKEN_TTL_SECONDS - 60) * 1000);
      expect(verifyConfirmationToken(token, noPrazo)).toEqual({ ok: true, subscriberId: ID });
    });

    it('recusa assinatura adulterada', () => {
      const token = signConfirmationToken(ID);
      expect(verifyConfirmationToken(tamperSignature(token))).toEqual({ ok: false, reason: 'invalid' });
    });

    it('recusa payload trocado com a assinatura antiga', () => {
      const token = signConfirmationToken(ID);
      expect(verifyConfirmationToken(tamperPayload(token, 'outro-id-qualquer'))).toEqual({
        ok: false,
        reason: 'invalid',
      });
    });

    it('recusa lixo e valores não textuais', () => {
      for (const v of [undefined, null, '', 'abc', 'a.b.c', 42, {}]) {
        expect(verifyConfirmationToken(v)).toEqual({ ok: false, reason: 'invalid' });
      }
    });

    it('recusa token assinado com outro segredo', () => {
      // Segredo gerado na hora: nenhum valor fixo no repositório
      process.env.NEWSLETTER_TOKEN_SECRET = randomBytes(32).toString('hex');
      const token = signConfirmationToken(ID);
      delete process.env.NEWSLETTER_TOKEN_SECRET;
      expect(verifyConfirmationToken(token)).toEqual({ ok: false, reason: 'invalid' });
    });
  });

  describe('descadastro', () => {
    it('aceita token válido e devolve o id', () => {
      expect(verifyUnsubscribeToken(signUnsubscribeToken(ID))).toBe(ID);
    });

    it('recusa assinatura adulterada', () => {
      expect(verifyUnsubscribeToken(tamperSignature(signUnsubscribeToken(ID)))).toBeNull();
    });

    it('não confunde os propósitos: token de confirmação não descadastra e vice-versa', () => {
      expect(verifyUnsubscribeToken(signConfirmationToken(ID))).toBeNull();
      expect(verifyConfirmationToken(signUnsubscribeToken(ID))).toEqual({ ok: false, reason: 'invalid' });
    });

    it('recusa valores vazios', () => {
      expect(verifyUnsubscribeToken(undefined)).toBeNull();
      expect(verifyUnsubscribeToken('')).toBeNull();
    });
  });
});
