import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNewDocumentsNotification } from '@/lib/email';
import { courses } from '@/data/courses';
import { verifyCronAuth } from '@/lib/cron-auth';

/**
 * API de Cron Job para notificar alunos sobre novos documentos
 *
 * Executa diariamente às 9h da manhã
 * Agrupa documentos adicionados no dia anterior
 * Envia um email por curso para cada aluno matriculado
 *
 * Vercel Cron: 0 9 * * * (9h UTC = 6h BRT)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação do cron (segurança)
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    console.log('🔔 [CRON] Iniciando notificação de novos documentos...');

    // Data de ontem (início e fim do dia)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar documentos adicionados ontem que ainda não foram notificados
    const newDocuments = await prisma.document.groupBy({
      by: ['courseId'],
      where: {
        uploadedAt: {
          gte: yesterday,
          lt: today,
        },
        notifiedAt: null,
      },
      _count: true,
    });

    console.log(`📊 [CRON] Encontrados documentos novos em ${newDocuments.length} curso(s)`);

    if (newDocuments.length === 0) {
      console.log('✅ [CRON] Nenhum documento novo para notificar');
      return NextResponse.json({
        success: true,
        message: 'Nenhum documento novo para notificar',
        sent: 0,
      });
    }

    let totalEmailsSent = 0;
    let totalErrors = 0;

    // Para cada curso com documentos novos
    for (const { courseId } of newDocuments) {
      try {
        // Buscar os documentos novos deste curso
        const courseDocuments = await prisma.document.findMany({
          where: {
            courseId,
            uploadedAt: {
              gte: yesterday,
              lt: today,
            },
            notifiedAt: null,
          },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            uploadedAt: true,
          },
          orderBy: {
            uploadedAt: 'asc',
          },
        });

        if (courseDocuments.length === 0) continue;

        // Buscar informações do curso
        const course = courses.find(c => c.id === courseId);
        if (!course) {
          console.warn(`⚠️ [CRON] Curso ${courseId} não encontrado`);
          continue;
        }

        console.log(`📚 [CRON] Processando ${courseDocuments.length} documento(s) do curso: ${course.title}`);

        // Buscar alunos matriculados neste curso
        if (!courseId) continue; // Skip documents without courseId
        const enrollments = await prisma.enrollment.findMany({
          where: {
            courseId,
            OR: [
              { expiresAt: { gt: new Date() } }, // Ainda não expirou
              { isLifetime: true }, // Acesso vitalício
            ],
          },
          include: {
            user: {
              select: {
                email: true,
                name: true,
                emailVerified: true,
              },
            },
          },
        });

        console.log(`👥 [CRON] Encontrados ${enrollments.length} aluno(s) matriculado(s)`);

        // Enviar email para cada aluno
        for (const enrollment of enrollments) {
          const { user } = enrollment;

          // Pular se email não verificado
          if (!user.emailVerified) {
            console.log(`⏭️ [CRON] Pulando ${user.email} (email não verificado)`);
            continue;
          }

          try {
            const sent = await sendNewDocumentsNotification(
              user.email,
              user.name,
              course.title,
              courseDocuments
            );

            if (sent) {
              totalEmailsSent++;
              console.log(`✅ [CRON] Email enviado para: ${user.email}`);
            } else {
              totalErrors++;
              console.error(`❌ [CRON] Falha ao enviar para: ${user.email}`);
            }
          } catch (error) {
            totalErrors++;
            console.error(`❌ [CRON] Erro ao enviar email para ${user.email}:`, error);
          }
        }

        // Marcar documentos como notificados
        const documentIds = courseDocuments.map(d => d.id);
        await prisma.document.updateMany({
          where: {
            id: { in: documentIds },
          },
          data: {
            notifiedAt: new Date(),
          },
        });

        console.log(`✅ [CRON] ${documentIds.length} documento(s) marcado(s) como notificado(s)`);
      } catch (error) {
        console.error(`❌ [CRON] Erro ao processar curso ${courseId}:`, error);
        totalErrors++;
      }
    }

    console.log(`🎉 [CRON] Processo concluído! Enviados: ${totalEmailsSent} | Erros: ${totalErrors}`);

    return NextResponse.json({
      success: true,
      message: 'Notificações processadas com sucesso',
      sent: totalEmailsSent,
      errors: totalErrors,
      coursesProcessed: newDocuments.length,
    });
  } catch (error) {
    console.error('❌ [CRON] Erro fatal:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao processar notificações',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
