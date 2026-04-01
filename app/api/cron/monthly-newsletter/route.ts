import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { verifyCronAuth } from '@/lib/cron-auth';
import { randomUUID } from 'crypto';
import { renderMonthlyNewsletter } from '@/lib/email-templates/newsletter';
import { filterByRelevance, type DecisionInput } from '@/lib/newsletter/relevance-filter';
import { generateNewsletterIntro } from '@/lib/newsletter/intro-generator';

// Allow up to 120s for AI processing + email sending
export const maxDuration = 120;

/**
 * Cron Job: Newsletter Mensal v0.2
 *
 * Pipeline:
 * 1. Busca documentos, decisões, blog posts, publicações, vídeos, atos legislativos (30 dias)
 * 2. Filtra acórdãos por relevância com IA (10-25 selecionados)
 * 3. Gera texto introdutório com IA (panorama do mês)
 * 4. Renderiza newsletter com todas as seções
 * 5. Envia via Resend (sequencial, 600ms delay)
 *
 * Segurança: Requer Authorization: Bearer <CRON_SECRET>
 * Agendamento: Configurado no vercel.json (mensal - dia 1 às 9h)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificação de segurança
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';

    console.log(`[Cron Newsletter v0.2] Iniciando${dryRun ? ' (DRY RUN)' : ''}...`);

    // 2. Busca todos os dados dos últimos 30 dias (paralelo)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      newDocuments,
      newTribunalDecisions,
      newBlogPosts,
      newPublications,
      newVideos,
      newLegislativeActs,
    ] = await Promise.all([
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
          ementa: true,
          summary: true,
          createdAt: true,
        },
      }),
      prisma.blogPost.findMany({
        where: {
          publishedAt: { gte: thirtyDaysAgo },
          isPublished: true,
        },
        orderBy: { publishedAt: 'desc' },
        select: {
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
        },
      }),
      prisma.publication.findMany({
        where: {
          publishedAt: { gte: thirtyDaysAgo },
          isPublished: true,
        },
        orderBy: { publishedAt: 'desc' },
        select: {
          title: true,
          type: true,
          description: true,
          externalUrl: true,
          publishedAt: true,
        },
      }),
      prisma.courseVideo.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          title: true,
          courseId: true,
          youtubeUrl: true,
        },
      }),
      prisma.legislativeAct.findMany({
        where: {
          publishDate: { gte: thirtyDaysAgo },
        },
        orderBy: { publishDate: 'desc' },
        select: {
          fullNumber: true,
          title: true,
          ementa: true,
          publishDate: true,
        },
      }),
    ]);

    const totalItems = newDocuments.length + newTribunalDecisions.length;
    console.log(`[Cron Newsletter v0.2] Dados: ${newDocuments.length} docs, ${newTribunalDecisions.length} decisões, ${newBlogPosts.length} posts, ${newPublications.length} publicações, ${newVideos.length} vídeos, ${newLegislativeActs.length} atos`);

    // Se não houver conteúdo novo, não envia newsletter
    if (totalItems === 0 && newBlogPosts.length === 0 && newPublications.length === 0) {
      console.log('[Cron Newsletter v0.2] Nenhum conteúdo novo, newsletter não enviada');
      return NextResponse.json({
        success: true,
        message: 'Nenhum conteúdo novo para enviar na newsletter',
        documentCount: 0,
      });
    }

    // 3. Separar acórdãos dos demais documentos
    const acordaoDocs = newDocuments.filter(d => d.category === 'acordao');
    const otherDocs = newDocuments.filter(d => d.category !== 'acordao');

    // Montar input unificado de decisões para o filtro de relevância
    const allDecisions: DecisionInput[] = [
      ...acordaoDocs.map(d => ({
        id: d.id,
        title: d.title,
        description: d.description,
        category: 'acordao' as const,
      })),
      ...newTribunalDecisions.map(td => ({
        id: td.id,
        title: td.title,
        description: td.summary || td.ementa.substring(0, 300),
        ementa: td.ementa,
        summary: td.summary,
        tribunalCode: td.tribunalCode,
        category: 'tribunal-decisions' as const,
      })),
    ];

    console.log(`[Cron Newsletter v0.2] ${allDecisions.length} decisões para filtrar, ${otherDocs.length} outros documentos`);

    // 4. Filtrar acórdãos por relevância com IA
    const filterResult = await filterByRelevance(allDecisions);
    console.log(`[Cron Newsletter v0.2] Filtro: ${filterResult.totalSelected}/${filterResult.totalEvaluated} decisões selecionadas`);

    // 5. Agrupar demais documentos por categoria (excluindo acórdãos)
    const documentsByCategory = otherDocs.reduce((acc, doc) => {
      if (!acc[doc.category]) {
        acc[doc.category] = [];
      }
      acc[doc.category].push(doc);
      return acc;
    }, {} as Record<string, typeof otherDocs>);

    // 6. Gerar texto introdutório com IA
    const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const now = new Date();
    const monthName = `${monthNames[now.getMonth()]} de ${now.getFullYear()}`;

    const categorySummary: Record<string, number> = {};
    for (const [cat, docs] of Object.entries(documentsByCategory)) {
      categorySummary[cat] = docs.length;
    }
    if (filterResult.totalSelected > 0) {
      categorySummary['jurisprudência selecionada'] = filterResult.totalSelected;
    }

    const introHtml = await generateNewsletterIntro({
      selectedDecisions: filterResult.selected,
      categorySummary,
      authorContent: {
        blogPosts: newBlogPosts,
        publications: newPublications,
        videos: newVideos,
      },
      legislativeChanges: newLegislativeActs,
      monthName,
      totalDocuments: totalItems,
    });

    console.log('[Cron Newsletter v0.2] Texto introdutório gerado');

    // 7. Buscar inscritos ativos
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true, name: true },
    });

    console.log(`[Cron Newsletter v0.2] ${subscribers.length} inscritos ativos`);

    if (subscribers.length === 0) {
      console.log('[Cron Newsletter v0.2] Nenhum inscrito ativo');
      return NextResponse.json({
        success: true,
        message: 'Nenhum inscrito ativo para enviar newsletter',
        documentCount: totalItems,
      });
    }

    // 8. Gerar HTML da newsletter
    const sendId = randomUUID();
    const subject = `Newsletter: ${filterResult.totalSelected} decisões selecionadas e ${totalItems} documentos em ${monthName}`;

    const newsletterHtml = renderMonthlyNewsletter({
      sendId,
      introHtml,
      authorContent: {
        blogPosts: newBlogPosts,
        publications: newPublications,
        videos: newVideos,
      },
      selectedDecisions: filterResult.selected,
      documentsByCategory,
      legislativeChanges: newLegislativeActs,
      totalDocuments: totalItems,
    });

    // Dry run: return data without sending
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Newsletter gerada em modo dry run (não enviada)',
        stats: {
          totalDocuments: totalItems,
          decisionsEvaluated: filterResult.totalEvaluated,
          decisionsSelected: filterResult.totalSelected,
          selectedDecisions: filterResult.selected.map(d => ({
            title: d.title,
            tribunal: d.tribunalCode,
            score: d.relevanceScore,
            summary: d.aiSummary.substring(0, 100),
          })),
          otherCategories: Object.fromEntries(
            Object.entries(documentsByCategory).map(([k, v]) => [k, v.length])
          ),
          blogPosts: newBlogPosts.length,
          publications: newPublications.length,
          videos: newVideos.length,
          legislativeChanges: newLegislativeActs.length,
          subscribers: subscribers.length,
          introPreview: introHtml.substring(0, 300),
          subject,
        },
      });
    }

    // 9. Inicializar Resend e criar registro de envio
    const resend = new Resend(process.env.RESEND_API_KEY);

    await prisma.newsletterSend.create({
      data: {
        id: sendId,
        type: 'monthly',
        subject,
        totalSent: 0,
        totalFailed: 0,
      },
    });

    // 10. Enviar emails (sequencial, respeitando rate limit Resend: 2/s)
    const fromAddress = process.env.EMAIL_FROM || 'newsletter@profdanielbarral.com';
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ email: string; error: string }> = [];

    console.log(`[Cron Newsletter v0.2] FROM: ${fromAddress} | Enviando para ${subscribers.length} inscritos...`);

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
          console.error(`[Cron Newsletter v0.2] Resend erro para ${subscriber.email}: ${msg}`);
        } else {
          successCount++;
          console.log(`[Cron Newsletter v0.2] Enviado para ${subscriber.email} (id: ${result.data?.id})`);
        }
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ email: subscriber.email, error: msg });
        console.error(`[Cron Newsletter v0.2] Erro para ${subscriber.email}: ${msg}`);
      }

      // Delay de 600ms entre envios para respeitar rate limit (2 req/s)
      await new Promise(r => setTimeout(r, 600));
    }

    console.log(`[Cron Newsletter v0.2] Emails enviados: ${successCount} sucesso, ${errorCount} erro`);

    // 11. Atualizar registro com contagens
    await prisma.newsletterSend.update({
      where: { id: sendId },
      data: { totalSent: successCount, totalFailed: errorCount },
    });

    return NextResponse.json({
      success: true,
      message: 'Newsletter mensal v0.2 enviada com sucesso',
      stats: {
        totalDocuments: totalItems,
        decisionsSelected: filterResult.totalSelected,
        decisionsEvaluated: filterResult.totalEvaluated,
        blogPosts: newBlogPosts.length,
        publications: newPublications.length,
        videos: newVideos.length,
        legislativeChanges: newLegislativeActs.length,
        subscribers: subscribers.length,
        emailsSent: successCount,
        emailsFailed: errorCount,
        sendId,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

  } catch (error) {
    console.error('[Cron Newsletter v0.2] Erro fatal:', error);
    return NextResponse.json(
      {
        error: 'Erro ao enviar newsletter mensal',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
