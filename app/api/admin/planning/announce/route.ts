import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import {
  PLANNING_ANNOUNCE_SUBJECT,
  renderPlanningAnnounceEmail,
} from '@/lib/email-templates/planning-announce';

/**
 * One-shot broadcast anunciando o módulo Planejamento da Contratação.
 *
 * Envia para usuários distintos com enrollment ativo (não expirado).
 * Suporta `?dryRun=true` para listar destinatários sem enviar.
 *
 * Idempotência: o endpoint NÃO previne reenvio. Use dryRun primeiro;
 * o admin é responsável por chamar uma única vez. Para reenvio seletivo,
 * filtre via dryRun e use um broadcast diferente.
 */
export const POST = withAdminApi(async (request) => {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  // Busca alunos com enrollment ativo (ou sem expiresAt = subscription ativa)
  const enrollments = await prisma.enrollment.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  const userMap = new Map<string, { id: string; email: string; name: string | null }>();
  for (const e of enrollments) {
    if (e.user && e.user.email) {
      userMap.set(e.user.id, e.user);
    }
  }
  const recipients = Array.from(userMap.values());

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      recipientCount: recipients.length,
      sampleEmails: recipients.slice(0, 10).map((r) => r.email),
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      message: 'Nenhum aluno com enrollment ativo.',
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, 'RESEND_API_KEY não configurada', 'CONFIG_MISSING');
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.EMAIL_FROM || 'newsletter@profdanielbarral.com';

  let sent = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const r of recipients) {
    try {
      const html = renderPlanningAnnounceEmail({ recipientName: r.name ?? '' });
      const result = await resend.emails.send({
        from: fromAddress,
        to: r.email,
        subject: PLANNING_ANNOUNCE_SUBJECT,
        html,
      });
      if (result.error) {
        failed++;
        errors.push({ email: r.email, error: result.error.message });
        apiLogger.error({ email: r.email, err: result.error.message }, 'planning-announce envio falhou');
      } else {
        sent++;
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ email: r.email, error: msg });
      apiLogger.error({ email: r.email, err: msg }, 'planning-announce envio exception');
    }
  }

  // Tracking: registra em NewsletterSend com type='announce-planning'
  await prisma.newsletterSend.create({
    data: {
      type: 'announce-planning',
      subject: PLANNING_ANNOUNCE_SUBJECT,
      totalSent: sent,
      totalFailed: failed,
    },
  });

  return NextResponse.json({
    sent,
    failed,
    errors: errors.slice(0, 20),
  });
});
