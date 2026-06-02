import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { verifyCronAuth } from '@/lib/cron-auth';
import { randomUUID } from 'crypto';
import { renderMonthlyNewsletter } from '@/lib/email-templates/newsletter';
import { filterByRelevance, type DecisionInput } from '@/lib/newsletter/relevance-filter';
import { generateNewsletterIntro } from '@/lib/newsletter/intro-generator';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

// Aumentado para 800s (limite Vercel Pro) em 2026-06-02 — newsletter de
// junho caiu por FUNCTION_INVOCATION_TIMEOUT (504) novamente com 300s,
// volume cresceu desde maio. Combinado com paralelização do filterByRelevance
// (lib/newsletter/relevance-filter.ts) e try/finally que sempre atualiza o
// NewsletterSend mesmo em crash/timeout — evita registros órfãos.
// Histórico: 120s (original) → 300s (2026-05-01) → 800s (2026-06-02).
export const maxDuration = 800;

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
  // 1. Verificação de segurança (fora do telemetry)
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  // sendId / completedNormally vivem no escopo externo para que o catch consiga
  // marcar o registro NewsletterSend como [crash:*] caso o pipeline morra.
  // Sem isso, falha silenciosa deixava `[em processamento]` órfão no banco
  // (newsletter de junho/2026 — TIMEOUT 504 deixou registro sem update final).
  let sendId: string | null = null;
  let completedNormally = false;
  try {
    await withCronTelemetry('monthly-newsletter', async () => {

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
      responseBody = {
        success: true,
        message: 'Nenhum conteúdo novo para enviar na newsletter',
        documentCount: 0,
      };
      return { itemsFound: 0 };
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

    // 3b. Criar registro NewsletterSend com status 'started' já — assim
    // qualquer falha silenciosa adiante deixa pista no DB. Atualizado
    // depois com totalSent/totalFailed reais. sendId vive no escopo externo
    // para que o catch consiga marcar como [crash] em falha.
    sendId = randomUUID();
    if (!dryRun) {
      await prisma.newsletterSend.create({
        data: {
          id: sendId,
          type: 'monthly',
          subject: `[em processamento] Newsletter mensal — disparo iniciado`,
          totalSent: 0,
          totalFailed: 0,
        },
      });
    }

    // 4. Filtrar acórdãos por relevância com IA (com fallback pra modo
    // sem IA se Gemini falhar/timeout — newsletter sai mesmo sem ranking)
    let filterResult: Awaited<ReturnType<typeof filterByRelevance>>;
    try {
      filterResult = await filterByRelevance(allDecisions);
      console.log(`[Cron Newsletter v0.2] Filtro: ${filterResult.totalSelected}/${filterResult.totalEvaluated} decisões selecionadas`);
    } catch (err) {
      apiLogger.error({ err: err }, '[Cron Newsletter v0.2] filterByRelevance falhou — fallback sem IA:');
      // Fallback: pegar até 25 decisões mais recentes sem score IA
      const fallbackSelected = allDecisions.slice(0, 25).map((d) => ({
        id: d.id,
        title: d.title,
        tribunalCode: d.tribunalCode || 'TCU',
        relevanceScore: 0,
        aiSummary: d.summary || (d.ementa || d.description || '').substring(0, 200),
        themes: [] as string[],
        leiArticles: [] as string[],
      }));
      filterResult = {
        selected: fallbackSelected,
        totalEvaluated: allDecisions.length,
        totalSelected: fallbackSelected.length,
      };
    }

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

    let introHtml: string;
    try {
      introHtml = await generateNewsletterIntro({
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
    } catch (err) {
      apiLogger.error({ err: err }, '[Cron Newsletter v0.2] generateNewsletterIntro falhou — fallback genérico:');
      introHtml = `<p>Olá, este é o panorama de <strong>${monthName}</strong> dos principais conteúdos de Licitações e Contratos publicados no portal: ${filterResult.totalSelected} decisões selecionadas, ${totalItems} documentos novos, ${newLegislativeActs.length} atos legislativos.</p>`;
    }

    // 7. Buscar inscritos ativos
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true, name: true },
    });

    console.log(`[Cron Newsletter v0.2] ${subscribers.length} inscritos ativos`);

    if (subscribers.length === 0) {
      console.log('[Cron Newsletter v0.2] Nenhum inscrito ativo');
      responseBody = {
        success: true,
        message: 'Nenhum inscrito ativo para enviar newsletter',
        documentCount: totalItems,
      };
      return { itemsFound: totalItems, metadata: { noSubscribers: true } };
    }

    // 8. Gerar HTML da newsletter (sendId criado no passo 3b)
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
      responseBody = {
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
      };
      return { itemsFound: totalItems, metadata: { dryRun: true, subscribers: subscribers.length } };
    }

    // 9. Inicializar Resend e atualizar subject do registro criado no passo 3b
    const resend = new Resend(process.env.RESEND_API_KEY);

    await prisma.newsletterSend.update({
      where: { id: sendId },
      data: { subject },
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
          apiLogger.error(`[Cron Newsletter v0.2] Resend erro para ${subscriber.email}: ${msg}`);
        } else {
          successCount++;
          console.log(`[Cron Newsletter v0.2] Enviado para ${subscriber.email} (id: ${result.data?.id})`);
        }
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ email: subscriber.email, error: msg });
        apiLogger.error(`[Cron Newsletter v0.2] Erro para ${subscriber.email}: ${msg}`);
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

    // Marca como completo APÓS update final — assim qualquer crash entre 3b e 11
    // cai no catch externo e marca o registro como [crash].
    completedNormally = true;

      responseBody = {
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
      };
      return {
        itemsFound: totalItems,
        itemsNew: successCount,
        itemsError: errorCount,
        metadata: { subscribers: subscribers.length, sendId },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro ao enviar newsletter mensal',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  } finally {
    // Defesa contra registros NewsletterSend órfãos como `[em processamento]`:
    // se o pipeline criou sendId mas crashou/timeout antes do update final
    // (passo 11), marcamos o registro como [crash] com a mensagem do erro.
    // Best-effort: se o próprio update falhar (ex: conexão Neon perdida),
    // logamos e seguimos — não queremos mascarar o erro original. Causa raiz
    // da defesa: newsletter de junho/2026 ficou órfã após FUNCTION_INVOCATION_TIMEOUT.
    if (sendId && !completedNormally) {
      try {
        await prisma.newsletterSend.update({
          where: { id: sendId },
          data: { subject: '[crash] Newsletter mensal — pipeline interrompido (ver logs)' },
        });
        apiLogger.warn({ sendId }, '[Cron Newsletter v0.2] Pipeline interrompido — registro marcado como [crash]');
      } catch (updateErr) {
        apiLogger.error({ err: updateErr, sendId }, '[Cron Newsletter v0.2] Falha ao marcar registro como [crash]');
      }
    }
  }
}
