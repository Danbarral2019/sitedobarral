/**
 * Verificação de webhooks que usam o padrão Svix (Resend, outros).
 *
 * Svix assina cada webhook com HMAC-SHA256 sobre `<svix-id>.<svix-timestamp>.<body>`,
 * usando a webhook secret (formato `whsec_<base64>`). Sem essa validação,
 * qualquer um pode POSTar JSON válido e disparar efeitos colaterais
 * (ex: desativar subscribers, inflar contadores).
 *
 * Descoberto na auditoria silent-failures de 2026-05-16 que o webhook
 * /api/webhooks/resend aceitava qualquer POST — vulnerabilidade real.
 *
 * Spec: https://docs.svix.com/receiving/verifying-payloads/how-manual
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export interface SvixVerifyResult {
  valid: boolean;
  reason?: 'missing-headers' | 'missing-secret' | 'invalid-signature' | 'timestamp-too-old';
}

/** Tolerância de timestamp (5 minutos) para mitigar replay attacks. */
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

/**
 * Extrai headers `svix-*` do Request. Retorna `null` se algum estiver ausente.
 */
export function extractSvixHeaders(req: Request): SvixHeaders | null {
  const id = req.headers.get('svix-id');
  const timestamp = req.headers.get('svix-timestamp');
  const signature = req.headers.get('svix-signature');
  if (!id || !timestamp || !signature) return null;
  return { id, timestamp, signature };
}

/**
 * Verifica assinatura HMAC-SHA256 do webhook contra a secret.
 *
 * O `body` precisa ser o texto RAW (sem JSON.parse antes), porque qualquer
 * reformatação (espaços, ordem de campos) invalida a assinatura.
 *
 * A secret vem no formato `whsec_<base64>` — o prefixo é stripado antes
 * de decodar.
 */
export function verifySvixSignature(
  headers: SvixHeaders,
  body: string,
  secret: string,
): SvixVerifyResult {
  if (!secret) return { valid: false, reason: 'missing-secret' };

  // Reject se timestamp muito antigo (replay defense)
  const tsMs = Number(headers.timestamp) * 1000;
  if (Number.isFinite(tsMs) && Math.abs(Date.now() - tsMs) > MAX_TIMESTAMP_AGE_MS) {
    return { valid: false, reason: 'timestamp-too-old' };
  }

  // Strip prefixo `whsec_` antes de base64-decodar
  const secretBase64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const secretBytes = Buffer.from(secretBase64, 'base64');

  const signedContent = `${headers.id}.${headers.timestamp}.${body}`;
  const expectedSig = createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  // Header `svix-signature` é space-separated, formato `v1,<sig1> v1,<sig2>`
  // (várias secrets podem estar rotacionando). Qualquer match é válido.
  const provided = headers.signature.split(' ');
  for (const sig of provided) {
    const [version, hash] = sig.split(',');
    if (version !== 'v1' || !hash) continue;
    try {
      // timingSafeEqual exige buffers do mesmo tamanho — se hash for malformado
      // (ex: base64 inválido), Buffer.from retorna size diferente e jogamos no catch.
      const providedBytes = Buffer.from(hash, 'base64');
      const expectedBytes = Buffer.from(expectedSig, 'base64');
      if (providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)) {
        return { valid: true };
      }
    } catch {
      // Hash malformado — segue tentando os outros
    }
  }

  return { valid: false, reason: 'invalid-signature' };
}
