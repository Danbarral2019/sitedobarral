import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { courses } from '@/data/courses';
import { verifyCronAuth } from '@/lib/cron-auth';
import { randomUUID } from 'crypto';
import { renderWeeklyNewsletter } from '@/lib/email-templates/newsletter';

/**
 * API de Cron Job para enviar newsletter sobre novos conteúdos
 *
 * Executa semanalmente (toda segunda-feira às 10h)
 * Envia newsletter geral para todos os assinantes
 * Lista novidades da área logada (documentos, vídeos)
 *
 * Vercel Cron: 0 10 * * 1 (10h UTC segunda-feira = 7h BRT segunda-feira)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação do cron (segurança)
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    console.log('📰 [NEWSLETTER] Iniciando envio de newsletter semanal...');

    // Data de 7 dias atrás
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Buscar documentos novos da última semana agrupados por curso
    const newDocumentsByCourse = await prisma.document.groupBy({
      by: ['courseId'],
      where: {
        uploadedAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: true,
    });

    // Buscar vídeos novos da última semana
    const newVideos = await prisma.courseVideo.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Buscar decisões de tribunais aprovadas na última semana
    const newTribunalDecisions = await prisma.tribunalDecision.count({
      where: {
        approvalStatus: { in: ['auto_approved', 'manually_approved'] },
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const totalNewDocuments = newDocumentsByCourse.reduce((sum, item) => sum + item._count, 0);

    console.log(`📊 [NEWSLETTER] Encontrados ${totalNewDocuments} documentos, ${newVideos} vídeos e ${newTribunalDecisions} decisões de tribunais`);

    // Se não houver conteúdo novo, não envia newsletter
    if (totalNewDocuments === 0 && newVideos === 0 && newTribunalDecisions === 0) {
      console.log('✅ [NEWSLETTER] Nenhum conteúdo novo para enviar');
      return NextResponse.json({
        success: true,
        message: 'Nenhum conteúdo novo para newsletter',
        sent: 0,
      });
    }

    // Buscar assinantes ativos da newsletter
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: {
        isActive: true,
      },
      select: {
        email: true,
        name: true,
      },
    });

    console.log(`👥 [NEWSLETTER] Encontrados ${subscribers.length} assinante(s)`);

    if (subscribers.length === 0) {
      console.log('✅ [NEWSLETTER] Nenhum assinante para enviar');
      return NextResponse.json({
        success: true,
        message: 'Nenhum assinante ativo',
        sent: 0,
      });
    }

    // Buscar detalhes dos documentos por curso
    const coursesWithNewContent: Array<{
      courseTitle: string;
      documentCount: number;
      documents: Array<{ title: string; category: string }>;
    }> = [];

    for (const { courseId, _count } of newDocumentsByCourse) {
      const course = courses.find(c => c.id === courseId);
      if (!course) continue;

      const documents = await prisma.document.findMany({
        where: {
          courseId,
          uploadedAt: {
            gte: sevenDaysAgo,
          },
        },
        select: {
          title: true,
          category: true,
        },
        take: 5, // Limitar a 5 documentos por curso
        orderBy: {
          uploadedAt: 'desc',
        },
      });

      coursesWithNewContent.push({
        courseTitle: course.title,
        documentCount: _count,
        documents,
      });
    }

    // Gerar sendId e HTML com template
    const sendId = randomUUID();
    const totalContent = totalNewDocuments + newVideos + newTribunalDecisions;
    const subject = `${totalContent} novos conteudos esta semana!`;
    const newsletterHtml = renderWeeklyNewsletter({
      sendId,
      coursesWithNewContent,
      totalNewDocuments,
      newVideos,
      newTribunalDecisions,
    });

    // Criar registro de envio (antes do envio para que o tracking pixel funcione)
    await prisma.newsletterSend.create({
      data: {
        id: sendId,
        type: 'weekly',
        subject,
        totalSent: 0,
        totalFailed: 0,
      },
    });

    // Enviar newsletter para cada assinante
    let totalSent = 0;
    let totalErrors = 0;

    for (const subscriber of subscribers) {
      const html = newsletterHtml.replace('{{NAME}}', subscriber.name || 'Assinante');

      try {
        const sent = await sendEmail({
          to: subscriber.email,
          subject,
          html,
        });

        if (sent.success) {
          totalSent++;
          console.log(`[NEWSLETTER] Enviado para: ${subscriber.email}`);
        } else {
          totalErrors++;
          console.error(`[NEWSLETTER] Falha ao enviar para: ${subscriber.email}`);
        }
      } catch (error) {
        totalErrors++;
        console.error(`[NEWSLETTER] Erro ao enviar para ${subscriber.email}:`, error);
      }
    }

    // Atualizar registro com contagens
    await prisma.newsletterSend.update({
      where: { id: sendId },
      data: { totalSent, totalFailed: totalErrors },
    });

    console.log(`[NEWSLETTER] Processo concluido! Enviados: ${totalSent} | Erros: ${totalErrors}`);

    return NextResponse.json({
      success: true,
      message: 'Newsletter enviada com sucesso',
      sent: totalSent,
      errors: totalErrors,
      newDocuments: totalNewDocuments,
      newVideos,
      sendId,
    });
  } catch (error) {
    console.error('❌ [NEWSLETTER] Erro fatal:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao enviar newsletter',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
