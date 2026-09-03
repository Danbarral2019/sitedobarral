import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendExpirationNotification } from '@/lib/email';
import { shouldSendExpirationNotification } from '@/lib/enrollment-utils';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';


/**
 * API para verificar matrículas próximas da expiração e enviar notificações
 * Esta rota deve ser chamada por um cron job (pode usar Vercel Cron, GitHub Actions, etc)
 *
 * Segurança: Requer Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  // Auth fora do telemetry (auth != falha de cron)
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('enrollment-check-expiration', async () => {
      const now = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    // Buscar matrículas que:
    // 1. Não são vitalícias
    // 2. Expiram em até 90 dias
    // 3. Ainda não receberam notificação
    const expiringEnrollments = await prisma.enrollment.findMany({
      where: {
        isLifetime: false,
        expiresAt: {
          gte: now,
          lte: threeMonthsFromNow,
        },
        notificationSentAt: null,
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      take: 100,
    });

    const results = {
      total: expiringEnrollments.length,
      notified: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Processar cada matrícula
    for (const enrollment of expiringEnrollments) {
      try {
        // Verificar se deve enviar notificação
        if (!shouldSendExpirationNotification(enrollment, enrollment.notificationSentAt)) {
          continue;
        }

        // Calcular dias restantes
        const timeDiff = new Date(enrollment.expiresAt!).getTime() - now.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        // Enviar email de notificação
        const emailSent = await sendExpirationNotification(
          enrollment.user.email,
          enrollment.user.name,
          enrollment.courseId,
          daysRemaining,
          enrollment.expiresAt!
        );

        if (emailSent) {
          // Marcar notificação como enviada
          await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: {
              notificationSentAt: new Date(),
            },
          });

          results.notified++;
        } else {
          results.failed++;
          results.errors.push(`Falha ao enviar email para ${enrollment.user.email}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Erro ao processar enrollment ${enrollment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        apiLogger.error({ err: error, enrollmentId: enrollment.id }, 'Erro ao processar enrollment');
      }
    }

    responseBody = {
      success: true,
      message: 'Verificação de expiração concluída',
      results,
    };
    return {
      itemsFound: results.total,
      itemsNew: results.notified,
      itemsError: results.failed,
      metadata: { errorSamples: results.errors.slice(0, 3) },
    };
    });
    return NextResponse.json(responseBody, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Erro ao verificar expirações' },
      { status: 500 }
    );
  }
}

/**
 * GET - Para verificar status da API
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      message: 'API de verificação de expiração está funcionando',
      note: 'Use POST com Bearer token para executar verificação',
    },
    { status: 200 }
  );
}
