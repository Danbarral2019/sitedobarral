import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { apiLogger } from '@/lib/logger';
import { withCronTelemetry } from '@/lib/cron-telemetry';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/cron/monitoring-alerts
 * Cron a cada 6h: verifica anomalias e envia alerta por email ao admin.
 * Checks:
 * - Zero logins nas últimas 12h (possível outage)
 * - Scrapers com 3+ falhas consecutivas
 * - Feedback 👎 ≥30% na busca nos últimos 7 dias (com mín. 10 votos)
 * Schedule: every 6 hours
 */
const FEEDBACK_RATIO_THRESHOLD = 0.30;
const FEEDBACK_MIN_VOTES = 10;
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('monitoring-alerts', async () => {
      const alerts: string[] = [];
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // Check 1: Zero logins nas últimas 12h
    const recentLogins = await prisma.accessLog.count({
      where: {
        action: 'login',
        createdAt: { gte: twelveHoursAgo },
      },
    });

    if (recentLogins === 0) {
      alerts.push('Zero logins nas ultimas 12 horas — possivel outage ou problema de autenticacao.');
    }

    // Check 2: Scrapers com falhas consecutivas
    const allLogs = await prisma.scraperHealthLog.findMany({
      orderBy: { runAt: 'desc' },
      take: 100,
    });

    const scraperMap = new Map<string, typeof allLogs>();
    for (const log of allLogs) {
      if (!scraperMap.has(log.scraperCode)) {
        scraperMap.set(log.scraperCode, []);
      }
      scraperMap.get(log.scraperCode)!.push(log);
    }

    for (const [code, logs] of scraperMap) {
      let consecutiveFailures = 0;
      for (const log of logs) {
        if (log.status === 'failure') {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      if (consecutiveFailures >= 3) {
        const lastError = logs[0]?.errorMessage || 'sem mensagem';
        alerts.push(
          `Scraper "${code}" com ${consecutiveFailures} falhas consecutivas. Ultimo erro: ${lastError.slice(0, 200)}`
        );
      }
    }

    // Check 3: Feedback negativo na busca ≥30% nos últimos 7 dias (com mín. 10 votos)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const feedbackGroups = await prisma.searchHistory.groupBy({
      by: ['feedback'],
      where: {
        feedbackAt: { gte: sevenDaysAgo },
        feedback: { in: [1, -1] },
      },
      _count: { _all: true },
    });

    const positiveVotes =
      feedbackGroups.find((g) => g.feedback === 1)?._count._all ?? 0;
    const negativeVotes =
      feedbackGroups.find((g) => g.feedback === -1)?._count._all ?? 0;
    const totalVotes = positiveVotes + negativeVotes;

    if (totalVotes >= FEEDBACK_MIN_VOTES) {
      const negativeRatio = negativeVotes / totalVotes;
      if (negativeRatio >= FEEDBACK_RATIO_THRESHOLD) {
        alerts.push(
          `Feedback negativo na busca: ${negativeVotes} 👎 vs ${positiveVotes} 👍 ` +
            `nos ultimos 7 dias (${(negativeRatio * 100).toFixed(0)}%, threshold ${FEEDBACK_RATIO_THRESHOLD * 100}%). ` +
            `Investigar queries problematicas em /admin/search-analytics.`,
        );
      }
    }

    // Se há alertas, enviar email
    if (alerts.length > 0) {
      apiLogger.warn({ alertCount: alerts.length }, 'Monitoring alerts triggered');

      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM || '';
        if (!adminEmail) {
          apiLogger.warn('No ADMIN_ALERT_EMAIL or EMAIL_FROM configured, skipping alert email');
        } else {
          const alertList = alerts.map((a, i) => `${i + 1}. ${a}`).join('\n');

          await resend.emails.send({
            from: process.env.EMAIL_FROM || 'noreply@profdanielbarral.com',
            to: adminEmail,
            subject: `[Alerta] ${alerts.length} problema(s) detectado(s) — Site do Barral`,
            text: [
              'Alertas de monitoramento detectados:',
              '',
              alertList,
              '',
              `Verificado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
              '',
              'Acesse o painel admin para mais detalhes: /admin/monitoring',
            ].join('\n'),
          });

          apiLogger.info({ to: adminEmail, alertCount: alerts.length }, 'Alert email sent');
        }
      } catch (emailError) {
        apiLogger.error({ err: emailError }, 'Failed to send alert email');
      }
    }

      apiLogger.info(
        { alertCount: alerts.length },
        `Monitoring alerts check: ${alerts.length} alert(s)`
      );

      responseBody = {
        success: true,
        alertCount: alerts.length,
        alerts,
      };
      return {
        itemsFound: alerts.length,
        itemsError: alerts.length,
        metadata: { alerts },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
