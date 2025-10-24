import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { courses } from '@/data/courses';

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
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const totalNewDocuments = newDocumentsByCourse.reduce((sum, item) => sum + item._count, 0);

    console.log(`📊 [NEWSLETTER] Encontrados ${totalNewDocuments} documentos e ${newVideos} vídeos novos`);

    // Se não houver conteúdo novo, não envia newsletter
    if (totalNewDocuments === 0 && newVideos === 0) {
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
    let coursesWithNewContent: Array<{
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

    // Construir HTML do conteúdo
    let contentHtml = '';
    coursesWithNewContent.forEach(({ courseTitle, documentCount, documents }) => {
      contentHtml += `
        <div style="background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #2563eb;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937;">${courseTitle}</h3>
          <p style="color: #6b7280; margin: 0 0 10px 0;">${documentCount} ${documentCount === 1 ? 'novo material' : 'novos materiais'}</p>
          <ul style="margin: 0; padding-left: 20px;">
            ${documents.slice(0, 3).map(doc => `<li style="color: #374151; margin: 5px 0;">${doc.title}</li>`).join('')}
            ${documentCount > 3 ? `<li style="color: #6b7280; font-style: italic;">E mais ${documentCount - 3} ${documentCount - 3 === 1 ? 'material' : 'materiais'}...</li>` : ''}
          </ul>
        </div>
      `;
    });

    if (newVideos > 0) {
      contentHtml += `
        <div style="background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #dc2626;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937;">🎥 Vídeos</h3>
          <p style="color: #6b7280; margin: 0;">${newVideos} ${newVideos === 1 ? 'novo vídeo' : 'novos vídeos'} adicionado${newVideos > 1 ? 's' : ''}</p>
        </div>
      `;
    }

    // Enviar newsletter para cada assinante
    let totalSent = 0;
    let totalErrors = 0;

    for (const subscriber of subscribers) {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .stats-box { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📚 Novidades da Semana</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Newsletter Prof. Daniel Barral</p>
              </div>
              <div class="content">
                <p>Olá${subscriber.name ? ` <strong>${subscriber.name}</strong>` : ''},</p>

                <div class="stats-box">
                  <h2 style="margin: 0 0 10px 0; font-size: 32px;">${totalNewDocuments + newVideos}</h2>
                  <p style="margin: 0; font-size: 18px;">novos conteúdos esta semana!</p>
                </div>

                <p>Confira as novidades que foram adicionadas à plataforma nos últimos 7 dias:</p>

                ${contentHtml}

                <div style="background: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; color: #1e40af;">
                    <strong>💡 Para alunos matriculados:</strong> Todos esses materiais já estão disponíveis na sua área restrita!
                  </p>
                </div>

                <div style="text-align: center;">
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL}/area-restrita" class="button">📖 Acessar Plataforma</a>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

                <p style="font-size: 14px; color: #666;">
                  <strong>Não é aluno ainda?</strong> Conheça nossos cursos e <a href="${process.env.NEXT_PUBLIC_BASE_URL}/contato" style="color: #2563eb;">entre em contato</a> para participar das próximas turmas.
                </p>

                <p>Bons estudos!<br><strong>Equipe Prof. Daniel Barral</strong></p>
              </div>
              <div class="footer">
                <p>Você está recebendo este email porque se inscreveu em nossa newsletter.</p>
                <p style="font-size: 12px; margin-top: 10px;">
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL}" style="color: #666;">Visitar site</a> |
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL}/newsletter/cancelar" style="color: #666;">Cancelar inscrição</a>
                </p>
                <p>© ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        const sent = await sendEmail({
          to: subscriber.email,
          subject: `📚 ${totalNewDocuments + newVideos} novos conteúdos esta semana!`,
          html,
        });

        if (sent) {
          totalSent++;
          console.log(`✅ [NEWSLETTER] Enviado para: ${subscriber.email}`);
        } else {
          totalErrors++;
          console.error(`❌ [NEWSLETTER] Falha ao enviar para: ${subscriber.email}`);
        }
      } catch (error) {
        totalErrors++;
        console.error(`❌ [NEWSLETTER] Erro ao enviar para ${subscriber.email}:`, error);
      }
    }

    console.log(`🎉 [NEWSLETTER] Processo concluído! Enviados: ${totalSent} | Erros: ${totalErrors}`);

    return NextResponse.json({
      success: true,
      message: 'Newsletter enviada com sucesso',
      sent: totalSent,
      errors: totalErrors,
      newDocuments: totalNewDocuments,
      newVideos,
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
