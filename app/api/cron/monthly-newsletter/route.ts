import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { verifyCronAuth } from '@/lib/cron-auth';
import { randomUUID } from 'crypto';
import { renderMonthlyNewsletter } from '@/lib/email-templates/newsletter';

/**
 * Cron Job: Newsletter Mensal de Documentos Novos
 *
 * Envia email para todos os inscritos na newsletter com:
 * - Resumo de documentos adicionados no último mês
 * - Agrupados por categoria (Acórdãos, ONs, Pareceres, etc.)
 * - Links para acesso na área restrita
 *
 * Segurança: Requer Authorization: Bearer <CRON_SECRET>
 * Agendamento: Configurado no vercel.json (mensal - dia 1 às 9h)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificação de segurança
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    console.log('[Cron Newsletter] Iniciando envio de newsletter mensal...');

    // 2. Busca documentos adicionados nos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newDocuments = await prisma.document.findMany({
      where: {
        uploadedAt: {
          gte: thirtyDaysAgo,
        },
        isPublic: true, // Apenas documentos públicos na newsletter
      },
      orderBy: {
        uploadedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        uploadedAt: true,
        url: true,
      },
    });

    console.log(`[Cron Newsletter] ${newDocuments.length} documentos novos encontrados`);

    // Se não houver documentos novos, não envia newsletter
    if (newDocuments.length === 0) {
      console.log('[Cron Newsletter] Nenhum documento novo, newsletter não enviada');
      return NextResponse.json({
        success: true,
        message: 'Nenhum documento novo para enviar na newsletter',
        documentCount: 0,
      });
    }

    // 3. Agrupa documentos por categoria
    const documentsByCategory = newDocuments.reduce((acc, doc) => {
      if (!acc[doc.category]) {
        acc[doc.category] = [];
      }
      acc[doc.category].push(doc);
      return acc;
    }, {} as Record<string, typeof newDocuments>);

    // 4. Busca todos os inscritos ativos na newsletter
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: {
        isActive: true,
      },
      select: {
        email: true,
        name: true,
      },
    });

    console.log(`[Cron Newsletter] ${subscribers.length} inscritos ativos`);

    if (subscribers.length === 0) {
      console.log('[Cron Newsletter] Nenhum inscrito ativo');
      return NextResponse.json({
        success: true,
        message: 'Nenhum inscrito ativo para enviar newsletter',
        documentCount: newDocuments.length,
      });
    }

    // 5. Gera sendId e HTML da newsletter com template
    const sendId = randomUUID();
    const subject = `Novidades do mes: ${newDocuments.length} novos documentos de Licitacoes`;
    const newsletterHtml = renderMonthlyNewsletter({
      sendId,
      documentsByCategory,
      totalDocuments: newDocuments.length,
    });

    // 6. Inicializa Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 7. Cria registro de envio (antes do envio para que o tracking pixel funcione)
    await prisma.newsletterSend.create({
      data: {
        id: sendId,
        type: 'monthly',
        subject,
        totalSent: 0,
        totalFailed: 0,
      },
    });

    // 8. Envia email para todos os inscritos (em lote)
    const emailPromises = subscribers.map((subscriber) =>
      resend.emails.send({
        from: process.env.EMAIL_FROM || 'newsletter@profdanielbarral.com.br',
        to: subscriber.email,
        subject,
        html: newsletterHtml.replace('{{NAME}}', subscriber.name || 'Assinante'),
      })
    );

    const results = await Promise.allSettled(emailPromises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const errorCount = results.filter((r) => r.status === 'rejected').length;

    console.log(`[Cron Newsletter] Emails enviados: ${successCount} sucesso, ${errorCount} erro`);

    // 9. Atualiza registro com contagens
    await prisma.newsletterSend.update({
      where: { id: sendId },
      data: { totalSent: successCount, totalFailed: errorCount },
    });

    // 10. Log de erros se houver
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[Cron Newsletter] Erro ao enviar para ${subscribers[index].email}:`, result.reason);
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Newsletter mensal enviada com sucesso',
      stats: {
        documents: newDocuments.length,
        subscribers: subscribers.length,
        emailsSent: successCount,
        emailsFailed: errorCount,
        sendId,
      },
    });

  } catch (error) {
    console.error('[Cron Newsletter] Erro fatal:', error);
    return NextResponse.json(
      {
        error: 'Erro ao enviar newsletter mensal',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

