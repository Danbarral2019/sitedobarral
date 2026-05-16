import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { extractSvixHeaders, verifySvixSignature } from '@/lib/webhooks/svix';

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    from?: string;
    subject?: string;
    created_at?: string;
  };
}

/**
 * Resend Webhook Handler
 *
 * Processa eventos: delivered, opened, clicked, bounced.
 *
 * Segurança (corrige vuln descoberta na auditoria de 2026-05-16):
 * - Valida assinatura Svix (HMAC-SHA256) — sem isso qualquer um pode POSTar
 *   e marcar subscribers como inactive ou inflar contadores de clicks.
 * - Dedup via tabela ProcessedWebhookEvent — reusa o modelo do Stripe
 *   (PK string, comporta o svix-id sem schema change).
 * - Sentry.captureException em erro de processamento.
 * - apiLogger estruturado em vez de console.log/error.
 *
 * Env var necessária: RESEND_WEBHOOK_SECRET (formato `whsec_<base64>`,
 * obtida no painel Resend → Webhooks).
 */
export async function POST(request: NextRequest) {
  // 1. Extrair headers Svix
  const svixHeaders = extractSvixHeaders(request);
  if (!svixHeaders) {
    apiLogger.warn({ webhook: 'resend' }, 'Webhook recebido sem headers svix-*');
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // 2. Validar assinatura (precisa do body RAW — qualquer reformatação invalida)
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Fail-closed: sem secret configurada, rejeita TODOS os webhooks.
    Sentry.captureMessage('RESEND_WEBHOOK_SECRET ausente — webhooks rejeitados', 'error');
    apiLogger.error({ webhook: 'resend' }, 'RESEND_WEBHOOK_SECRET não configurada');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const verification = verifySvixSignature(svixHeaders, rawBody, secret);

  if (!verification.valid) {
    apiLogger.warn(
      { webhook: 'resend', svixId: svixHeaders.id, reason: verification.reason },
      'Webhook com assinatura inválida — possível tentativa de tampering',
    );
    return NextResponse.json({ error: 'Invalid signature', reason: verification.reason }, { status: 401 });
  }

  // 3. Dedup: ProcessedWebhookEvent já existe (era Stripe-only, agora aceita também
  // svix-id do Resend). Esta tabela usa PK string — o prefixo `resend:` evita
  // colisão com IDs Stripe `evt_*`.
  const dedupKey = `resend:${svixHeaders.id}`;

  try {
    await prisma.processedWebhookEvent.create({
      data: {
        stripeEventId: dedupKey,
        eventType: 'pending-parse',
      },
    });
  } catch (err) {
    // P2002 = unique violation = já processado. Idempotente: retorna 200 e segue.
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      apiLogger.info({ webhook: 'resend', svixId: svixHeaders.id }, 'Webhook duplicado — skip');
      return NextResponse.json({ received: true, dedup: true });
    }
    // Outro erro de DB — não bloqueia o webhook mas captura para Sentry.
    Sentry.captureException(err, { tags: { webhook: 'resend', stage: 'dedup' } });
    apiLogger.error({ err, svixId: svixHeaders.id }, 'Erro ao gravar dedup — seguindo com processamento');
  }

  // 4. Parse + processamento
  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch (parseErr) {
    Sentry.captureException(parseErr, { tags: { webhook: 'resend', stage: 'parse' } });
    apiLogger.error({ err: parseErr, svixId: svixHeaders.id }, 'JSON inválido no body do webhook');
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  apiLogger.info({ webhook: 'resend', svixId: svixHeaders.id, eventType: event.type }, 'Webhook recebido');

  try {
    switch (event.type) {
      case 'email.bounced': {
        const bouncedEmails = event.data.to || [];
        for (const email of bouncedEmails) {
          const result = await prisma.newsletterSubscriber.updateMany({
            where: { email, isActive: true },
            data: { isActive: false },
          });
          if (result.count > 0) {
            apiLogger.info({ webhook: 'resend', email, count: result.count }, 'Subscriber desativado por bounce');
          }
        }
        break;
      }

      case 'email.clicked': {
        const clickSubject = event.data.subject;
        if (clickSubject) {
          await prisma.newsletterSend.updateMany({
            where: { subject: clickSubject },
            data: { clicks: { increment: 1 } },
          });
        }
        break;
      }

      case 'email.delivered':
      case 'email.opened':
        // Sem ação no DB — apenas log para observabilidade
        break;

      default:
        apiLogger.info({ webhook: 'resend', eventType: event.type }, 'Tipo de evento sem handler');
    }

    // Atualiza dedup record com o tipo real (best-effort)
    await prisma.processedWebhookEvent
      .update({ where: { stripeEventId: dedupKey }, data: { eventType: `resend:${event.type}` } })
      .catch(() => { /* dedup nominal — não bloqueia */ });

    return NextResponse.json({ received: true });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { webhook: 'resend', stage: 'process', eventType: event.type },
      contexts: { event: { svixId: svixHeaders.id, type: event.type } },
    });
    apiLogger.error(
      { err: error, svixId: svixHeaders.id, eventType: event.type },
      'Erro processando webhook Resend',
    );
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
