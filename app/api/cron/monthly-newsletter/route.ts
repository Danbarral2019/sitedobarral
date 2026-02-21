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

    const [newDocuments, newTribunalDecisions] = await Promise.all([
      prisma.document.findMany({
        where: {
          uploadedAt: { gte: thirtyDaysAgo },
          isPublic: true,
        },
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          uploadedAt: true,
          url: true,
        },
      }),
      prisma.tribunalDecision.findMany({
        where: {
          approvalStatus: { in: ['auto_approved', 'manually_approved'] },
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          tribunalCode: true,
          summary: true,
          createdAt: true,
        },
      }),
    ]);

    console.log(`[Cron Newsletter] ${newDocuments.length} documentos e ${newTribunalDecisions.length} decisões de tribunais encontrados`);

    // Se não houver conteúdo novo, não envia newsletter
    if (newDocuments.length === 0 && newTribunalDecisions.length === 0) {
      console.log('[Cron Newsletter] Nenhum conteúdo novo, newsletter não enviada');
      return NextResponse.json({
        success: true,
        message: 'Nenhum conteúdo novo para enviar na newsletter',
        documentCount: 0,
      });
    }

    // 3. Agrupa documentos por categoria (incluindo decisões de tribunais)
    const documentsByCategory = newDocuments.reduce((acc, doc) => {
      if (!acc[doc.category]) {
        acc[doc.category] = [];
      }
      acc[doc.category].push(doc);
      return acc;
    }, {} as Record<string, typeof newDocuments>);

    // Adicionar decisões de tribunais como categoria "tribunal-decisions"
    if (newTribunalDecisions.length > 0) {
      (documentsByCategory as Record<string, Array<{ id: string; title: string; description: string | null; category: string; uploadedAt: Date; url: string | null }>>)['tribunal-decisions'] = newTribunalDecisions.map(td => ({
        id: td.id,
        title: td.title,
        description: td.summary || `Decisão ${td.tribunalCode}`,
        category: 'tribunal-decisions',
        uploadedAt: td.createdAt,
        url: null,
      }));
    }

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
    const totalItems = newDocuments.length + newTribunalDecisions.length;
    const subject = `Novidades do mes: ${totalItems} novos conteudos de Licitacoes`;
    const newsletterHtml = renderMonthlyNewsletter({
      sendId,
      documentsByCategory,
      totalDocuments: totalItems,
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

    // 8. Envia email para todos os inscritos (sequencial, respeitando rate limit do Resend: 2/s)
    const fromAddress = process.env.EMAIL_FROM || 'newsletter@profdanielbarral.com';
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ email: string; error: string }> = [];

    console.log(`[Cron Newsletter] FROM: ${fromAddress} | API_KEY set: ${!!process.env.RESEND_API_KEY}`);

    for (const subscriber of subscribers) {
      try {
        const result = await resend.emails.send({
          from: fromAddress,
          to: subscriber.email,
          subject,
          html: newsletterHtml.replace('{{NAME}}', subscriber.name || 'Assinante'),
        });

        if (result.error) {
          errorCount++;
          const msg = JSON.stringify(result.error);
          errors.push({ email: subscriber.email, error: msg });
          console.error(`[Cron Newsletter] Resend erro para ${subscriber.email}: ${msg}`);
        } else {
          successCount++;
          console.log(`[Cron Newsletter] Enviado para ${subscriber.email} (id: ${result.data?.id})`);
        }
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ email: subscriber.email, error: msg });
        console.error(`[Cron Newsletter] Erro para ${subscriber.email}: ${msg}`);
      }

      // Delay de 600ms entre envios para respeitar rate limit (2 req/s)
      await new Promise(r => setTimeout(r, 600));
    }

    console.log(`[Cron Newsletter] Emails enviados: ${successCount} sucesso, ${errorCount} erro`);

    // 9. Atualiza registro com contagens
    await prisma.newsletterSend.update({
      where: { id: sendId },
      data: { totalSent: successCount, totalFailed: errorCount },
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
        errors: errors.length > 0 ? errors : undefined,
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

