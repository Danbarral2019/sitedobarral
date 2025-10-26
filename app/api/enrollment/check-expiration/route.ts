import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendExpirationNotification } from '@/lib/email';
import { shouldSendExpirationNotification } from '@/lib/enrollment-utils';


/**
 * API para verificar matrículas próximas da expiração e enviar notificações
 * Esta rota deve ser chamada por um cron job (pode usar Vercel Cron, GitHub Actions, etc)
 *
 * Para segurança, requer um token de autorização
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar token de autorização do cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'change-this-secret-in-production';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

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
        user: true,
      },
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
        console.error(`Erro ao processar enrollment ${enrollment.id}:`, error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Verificação de expiração concluída',
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Check expiration error:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar expirações' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
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
