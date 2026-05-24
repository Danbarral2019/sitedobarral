import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/email';
import { withCronTelemetry } from '@/lib/cron-telemetry';

export const maxDuration = 30;

const BR_TZ_OFFSET_HOURS = 3;

function startOfBrasiliaDay(date: Date): Date {
  const offsetMs = BR_TZ_OFFSET_HOURS * 60 * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + offsetMs);
}

function isWeekend(date: Date): boolean {
  const local = new Date(date.getTime() - BR_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  const day = local.getUTCDay();
  return day === 0 || day === 6;
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('clipping-health-check', async () => {
      const now = new Date();
      if (isWeekend(now)) {
        responseBody = { ok: true, skipped: 'weekend' };
        return { itemsFound: 0, metadata: { skipped: 'weekend' } };
      }

      const sentDateKey = startOfBrasiliaDay(now);
      const alerts: string[] = [];

      const todaySend = await prisma.dailyClippingSend.findUnique({ where: { sentDate: sentDateKey } });

  if (!todaySend) {
    alerts.push('Nenhum DailyClippingSend registrado para hoje. Cron daily-tcu-clipping pode não ter rodado.');
  } else if (todaySend.status === 'failed') {
    alerts.push(`Envio de hoje falhou: ${todaySend.errorMessage || 'sem mensagem'}.`);
  } else if (todaySend.status === 'partial' && todaySend.totalSent === 0) {
    alerts.push(`Envio iniciado mas 0 emails saíram (totalRecipients=${todaySend.totalRecipients}). Erro: ${todaySend.errorMessage || 'sem mensagem'}.`);
  }

  const last5 = await prisma.dailyClippingSend.findMany({
    where: { sentDate: { lt: sentDateKey } },
    orderBy: { sentDate: 'desc' },
    take: 5,
  });
  const noContentStreak = last5.filter((s) => s.status === 'no_content').length;
  if (noContentStreak >= 3 && (!todaySend || todaySend.status === 'no_content')) {
    alerts.push(`${noContentStreak} dias consecutivos sem conteúdo no clipping. Possível bug no filtro de relevância.`);
    // Escalada pra Sentry quando streak passa de 5 dias — admin pode não ler email
    // a tempo, mas Sentry tem alerta configurável.
    if (noContentStreak >= 5) {
      Sentry.captureMessage('Clipping diário sem conteúdo há 5+ dias', {
        level: 'error',
        tags: { feature: 'clipping', subsystem: 'health-check' },
        extra: { noContentStreak, todayStatus: todaySend?.status ?? 'no_record' },
      });
    }
  }

      if (alerts.length === 0) {
        responseBody = { ok: true, status: 'healthy', todayStatus: todaySend?.status };
        return { itemsFound: 1, metadata: { healthy: true } };
      }

      const adminEmail = process.env.ADMIN_EMAIL || 'admin@profdanielbarral.com';
      const subject = `[Clipping TCU] Alerta de saúde — ${alerts.length} ${alerts.length === 1 ? 'problema' : 'problemas'}`;
      const body = `<h2>Alerta clipping diário TCU</h2>
<p>Detectamos ${alerts.length} ${alerts.length === 1 ? 'problema' : 'problemas'}:</p>
<ul>${alerts.map((a) => `<li>${a}</li>`).join('')}</ul>
<p>Verifique <code>/admin/clipping</code> e os logs do cron <code>daily-tcu-clipping</code>.</p>`;
      const text = `Alerta clipping diário TCU\n\n${alerts.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nVerifique /admin/clipping.`;

      await sendEmail({ to: adminEmail, subject, html: body, text });

      responseBody = { ok: false, alerts, alertSentTo: adminEmail };
      return { itemsFound: 1, itemsError: alerts.length, metadata: { alerts, alertSentTo: adminEmail } };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
