import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/email';
import { analyzeRelevanceTCU } from '@/lib/tcu-module';
import { extractMany, type DocumentLike } from '@/lib/clipping/dispositivo-extractor';
import { getClippingRecipients, applyBetaFilter } from '@/lib/clipping/recipients';
import { signUnsubscribeToken } from '@/lib/clipping/unsubscribe-token';
import { renderDailyClipping, type ClippingAcordao } from '@/lib/email-templates/daily-clipping';

export const maxDuration = 300;

const SEND_DELAY_MS = 600;
const RELEVANCE_THRESHOLD = 15;
const BR_TZ_OFFSET_HOURS = 3;

function startOfBrasiliaDay(date: Date): Date {
  const ms = date.getTime();
  const offsetMs = BR_TZ_OFFSET_HOURS * 60 * 60 * 1000;
  const local = new Date(ms - offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + offsetMs);
}

function getReferenceWindow(now: Date): { since: Date; until: Date; referenceDate: Date } {
  const todayStart = startOfBrasiliaDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDow = new Date(yesterdayStart.getTime() - BR_TZ_OFFSET_HOURS * 60 * 60 * 1000).getUTCDay();
  let since = yesterdayStart;
  if (yesterdayDow === 0 || yesterdayDow === 6) {
    since = new Date(todayStart.getTime() - 3 * 24 * 60 * 60 * 1000);
  }
  return { since, until: todayStart, referenceDate: yesterdayStart };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const now = new Date();
  const { since, until, referenceDate } = getReferenceWindow(now);
  const sentDateKey = startOfBrasiliaDay(now);
  const startedAt = new Date();

  console.log(`[DailyClipping] Iniciando${dryRun ? ' (DRY RUN)' : ''} — janela ${since.toISOString()} → ${until.toISOString()}`);

  if (!dryRun) {
    const existing = await prisma.dailyClippingSend.findUnique({ where: { sentDate: sentDateKey } });
    if (existing && existing.status === 'success') {
      console.log('[DailyClipping] Já enviado hoje — noop');
      return NextResponse.json({ ok: true, skipped: 'already_sent', sendId: existing.id });
    }
  }

  const candidates = await prisma.document.findMany({
    where: {
      category: 'acordao',
      uploadedAt: { gte: since, lt: until },
    },
    select: {
      id: true,
      title: true,
      description: true,
      url: true,
      tcuNumeroAcordao: true,
      tcuEmentaCompleta: true,
      tcuRelator: true,
      tcuOrgaoJulgador: true,
      tcuLinkPDF: true,
      tcuDataJulgamento: true,
      clippingExtract: {
        select: { dispositivos: true, extractMethod: true, pdfFetchFailed: true },
      },
    },
    orderBy: [{ tcuDataJulgamento: 'desc' }, { uploadedAt: 'desc' }],
  });

  console.log(`[DailyClipping] ${candidates.length} candidatos na janela`);

  const filtered = candidates.filter((c) => {
    const { score } = analyzeRelevanceTCU(c.title || '', c.tcuEmentaCompleta || c.description || '');
    return score >= RELEVANCE_THRESHOLD;
  });

  console.log(`[DailyClipping] ${filtered.length}/${candidates.length} passaram score >= ${RELEVANCE_THRESHOLD}`);

  if (filtered.length === 0) {
    if (!dryRun) {
      await prisma.dailyClippingSend.upsert({
        where: { sentDate: sentDateKey },
        create: {
          sentDate: sentDateKey,
          status: 'no_content',
          startedAt,
          finishedAt: new Date(),
          acordaoCount: 0,
        },
        update: {
          status: 'no_content',
          finishedAt: new Date(),
          acordaoCount: 0,
          errorMessage: null,
        },
      });
    }
    return NextResponse.json({ ok: true, status: 'no_content', candidates: candidates.length });
  }

  const docsLike: DocumentLike[] = filtered.map((c) => ({
    id: c.id,
    tcuEmentaCompleta: c.tcuEmentaCompleta,
    tcuLinkPDF: c.tcuLinkPDF,
    clippingExtract: c.clippingExtract ?? null,
  }));

  const extractResults = await extractMany(docsLike, 3);

  const acordaos: ClippingAcordao[] = filtered.map((c) => {
    const ex = extractResults.get(c.id);
    return {
      documentId: c.id,
      numeroAcordao: c.tcuNumeroAcordao || c.title || '',
      colegiado: c.tcuOrgaoJulgador || 'TCU',
      relator: c.tcuRelator,
      dataSessao: c.tcuDataJulgamento,
      ementa: (c.tcuEmentaCompleta || c.description || '').trim(),
      linkPdf: c.tcuLinkPDF,
      linkInternal: c.url,
      dispositivos: ex?.dispositivos || [],
      extractMethod: ex?.method || 'failed',
    };
  });

  const allRecipients = await getClippingRecipients();
  const recipients = applyBetaFilter(allRecipients, process.env.CLIPPING_BETA_EMAILS);

  console.log(`[DailyClipping] ${recipients.length}/${allRecipients.length} destinatários (beta=${process.env.CLIPPING_BETA_EMAILS ? 'on' : 'off'})`);

  if (dryRun) {
    const sample = recipients[0]
      ? renderDailyClipping({
          sendId: 'dry-run',
          recipientName: recipients[0].name,
          unsubscribeToken: signUnsubscribeToken(recipients[0].userId),
          referenceDate,
          acordaos,
        })
      : null;
    return NextResponse.json({
      ok: true,
      dryRun: true,
      candidates: candidates.length,
      filtered: filtered.length,
      recipientCount: recipients.length,
      acordaos: acordaos.map((a) => ({
        numeroAcordao: a.numeroAcordao,
        colegiado: a.colegiado,
        dataSessao: a.dataSessao,
        ementaPreview: a.ementa.slice(0, 200),
        dispositivosCount: a.dispositivos.length,
        extractMethod: a.extractMethod,
      })),
      sampleHtmlLength: sample?.html.length || 0,
      subject: sample?.subject,
    });
  }

  const sendId = randomUUID();
  const sendRecord = await prisma.dailyClippingSend.upsert({
    where: { sentDate: sentDateKey },
    create: {
      id: sendId,
      sentDate: sentDateKey,
      status: 'partial',
      startedAt,
      acordaoCount: acordaos.length,
      acordaoIdsIncluded: JSON.stringify(acordaos.map((a) => a.documentId)),
      totalRecipients: recipients.length,
    },
    update: {
      status: 'partial',
      startedAt,
      acordaoCount: acordaos.length,
      acordaoIdsIncluded: JSON.stringify(acordaos.map((a) => a.documentId)),
      totalRecipients: recipients.length,
      errorMessage: null,
      finishedAt: null,
    },
  });

  let totalSent = 0;
  let totalFailed = 0;
  let lastError: string | null = null;

  for (const r of recipients) {
    try {
      const token = signUnsubscribeToken(r.userId);
      const rendered = renderDailyClipping({
        sendId: sendRecord.id,
        recipientName: r.name,
        unsubscribeToken: token,
        referenceDate,
        acordaos,
      });
      const result = await sendEmail({
        to: r.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      if (result.success) {
        totalSent++;
      } else {
        totalFailed++;
        lastError = result.error || 'unknown';
      }
    } catch (e) {
      totalFailed++;
      lastError = e instanceof Error ? e.message : String(e);
    }
    await sleep(SEND_DELAY_MS);
  }

  const finalStatus = totalFailed === 0 ? 'success' : totalSent === 0 ? 'failed' : 'partial';

  await prisma.dailyClippingSend.update({
    where: { id: sendRecord.id },
    data: {
      status: finalStatus,
      totalSent,
      totalFailed,
      finishedAt: new Date(),
      errorMessage: lastError,
    },
  });

  console.log(`[DailyClipping] Concluído: ${totalSent} enviados, ${totalFailed} falhas, status=${finalStatus}`);

  return NextResponse.json({
    ok: finalStatus !== 'failed',
    status: finalStatus,
    sendId: sendRecord.id,
    acordaoCount: acordaos.length,
    totalSent,
    totalFailed,
    totalRecipients: recipients.length,
  });
}
