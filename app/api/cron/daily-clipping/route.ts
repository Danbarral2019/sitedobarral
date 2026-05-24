import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { sendEmail } from '@/lib/email';
import { extractMany, type DocumentLike } from '@/lib/clipping/dispositivo-extractor';
import {
  generateAiBulletsForTribunal,
  shouldGenerateBulletsForTribunal,
} from '@/lib/clipping/ai-bullets';
import {
  getClippingRecipients,
  applyBetaFilter,
  getAdminRecipientsFromEnv,
  mergeAdminRecipients,
} from '@/lib/clipping/recipients';
import { signUnsubscribeToken } from '@/lib/clipping/unsubscribe-token';
import { signViewToken } from '@/lib/clipping/view-token';
import { formatSentDateParam } from '@/lib/clipping/archive';
import {
  renderDailyClippingV2,
  type ClippingGroup,
  type ClippingItemRendered,
} from '@/lib/email-templates/daily-clipping';
import { fetchAllEligibleItems, type ClippingItem } from '@/lib/clipping/sources';
import {
  getSentIdsInWindow,
  buildSentItemsPayload,
} from '@/lib/clipping/sent-history';

export const maxDuration = 300;

const SEND_DELAY_MS = 600;
const BR_TZ_OFFSET_HOURS = 3;

// Defaults — overrideáveis por env (Fase 5)
const DEFAULT_TRIBUNAIS = 'TCU';
const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_MAX_PER_TRIBUNAL = 5;
const DEFAULT_MAX_TOTAL = 15;

function parseEnabledTribunais(): string[] {
  const raw = (process.env.CLIPPING_TRIBUNAIS_ENABLED || DEFAULT_TRIBUNAIS).trim();
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function startOfBrasiliaDay(date: Date): Date {
  const ms = date.getTime();
  const offsetMs = BR_TZ_OFFSET_HOURS * 60 * 60 * 1000;
  const local = new Date(ms - offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + offsetMs);
}

function getTcuReferenceWindow(now: Date): { since: Date; until: Date; referenceDate: Date } {
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

/**
 * Aplica cap global `MAX_TOTAL` priorizando maior relevanceScore. Mantém
 * agrupamento por tribunal mas remove itens excedentes.
 */
function applyGlobalCap(groups: Map<string, ClippingItem[]>, maxTotal: number): Map<string, ClippingItem[]> {
  let total = 0;
  for (const items of groups.values()) total += items.length;
  if (total <= maxTotal) return groups;

  // Achata, ordena por relevância desc, pega top maxTotal, reagrupa
  const flat: ClippingItem[] = [];
  for (const items of groups.values()) flat.push(...items);
  flat.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  const kept = flat.slice(0, maxTotal);

  const result = new Map<string, ClippingItem[]>();
  for (const item of kept) {
    const list = result.get(item.tribunalCode) || [];
    list.push(item);
    result.set(item.tribunalCode, list);
  }
  return result;
}

async function enrichTcuItem(item: ClippingItem): Promise<ClippingItemRendered> {
  // TCU continua usando pipeline de dispositivos + AI bullets via cache ClippingItemExtract
  const doc = await prisma.document.findUnique({
    where: { id: item.sourceId },
    select: {
      id: true,
      tcuEmentaCompleta: true,
      tcuLinkPDF: true,
      clippingExtract: {
        select: { dispositivos: true, extractMethod: true, pdfFetchFailed: true, aiBullets: true },
      },
    },
  });

  if (!doc) {
    return { item, dispositivos: [], aiBullets: [] };
  }

  const docsLike: DocumentLike[] = [{
    id: doc.id,
    tcuEmentaCompleta: doc.tcuEmentaCompleta,
    tcuLinkPDF: doc.tcuLinkPDF,
    clippingExtract: doc.clippingExtract ?? null,
  }];
  const extractResults = await extractMany(docsLike, 1);
  const ex = extractResults.get(doc.id);

  return {
    item,
    dispositivos: ex?.dispositivos || [],
    aiBullets: ex?.aiBullets,
  };
}

async function enrichTribunalItem(item: ClippingItem): Promise<ClippingItemRendered> {
  if (!shouldGenerateBulletsForTribunal(item)) {
    return { item, aiBullets: [] };
  }

  // Cache via TribunalDecision.aiBullets (gerados uma vez, imutáveis)
  const cached = await prisma.tribunalDecision.findUnique({
    where: { id: item.sourceId },
    select: { aiBullets: true },
  });
  if (cached?.aiBullets) {
    try {
      const parsed = JSON.parse(cached.aiBullets);
      if (Array.isArray(parsed)) return { item, aiBullets: parsed };
    } catch {
      // ignora cache inválido e regenera
    }
  }

  const bullets = await generateAiBulletsForTribunal(item);
  if (bullets.length > 0) {
    try {
      await prisma.tribunalDecision.update({
        where: { id: item.sourceId },
        data: { aiBullets: JSON.stringify(bullets), aiGeneratedAt: new Date() },
      });
    } catch (e) {
      console.warn(`[DailyClipping] Falha ao persistir aiBullets do ${item.sourceId}:`, e instanceof Error ? e.message : e);
    }
  }
  return { item, aiBullets: bullets };
}

async function enrichItem(item: ClippingItem): Promise<ClippingItemRendered> {
  if (item.sourceKind === 'document-tcu') return enrichTcuItem(item);
  return enrichTribunalItem(item);
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('daily-clipping', async () => {
      const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
      const now = new Date();
      const { since: tcuSince, until: tcuUntil, referenceDate } = getTcuReferenceWindow(now);
      const sentDateKey = startOfBrasiliaDay(now);
      const startedAt = new Date();

      const enabledTribunais = parseEnabledTribunais();
      const windowDays = parseIntEnv('CLIPPING_WINDOW_DAYS', DEFAULT_WINDOW_DAYS);
      const maxPerTribunal = parseIntEnv('CLIPPING_MAX_ITEMS_PER_TRIBUNAL', DEFAULT_MAX_PER_TRIBUNAL);
      const maxTotal = parseIntEnv('CLIPPING_MAX_ITEMS_TOTAL', DEFAULT_MAX_TOTAL);

      console.log(`[DailyClipping]${dryRun ? ' (DRY RUN)' : ''} tribunais=${enabledTribunais.join(',')} windowDays=${windowDays} maxPerTribunal=${maxPerTribunal} maxTotal=${maxTotal}`);

      if (!dryRun) {
        const existing = await prisma.dailyClippingSend.findUnique({ where: { sentDate: sentDateKey } });
        if (existing && existing.status === 'success') {
          console.log('[DailyClipping] Já enviado hoje — noop');
          responseBody = { ok: true, skipped: 'already_sent', sendId: existing.id };
          return { itemsFound: 0, metadata: { skipped: 'already_sent' } };
        }
      }

  // 1. Histórico — itens já destacados nos últimos N dias
  const alreadySentKeys = await getSentIdsInWindow(windowDays);

  // 2. Fetch elegíveis por tribunal
  let groups = await fetchAllEligibleItems({
    enabledTribunais,
    tcuSince,
    tcuUntil,
    windowDays,
    alreadySentKeys,
    maxItemsPerTribunal: maxPerTribunal,
  });

  // 3. Cap global por relevância
  groups = applyGlobalCap(groups, maxTotal);

  const totalItems = Array.from(groups.values()).reduce((acc, items) => acc + items.length, 0);
  console.log(`[DailyClipping] ${totalItems} itens elegíveis em ${groups.size} tribunais (após dedup + cap)`);

  if (totalItems === 0) {
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
    responseBody = { ok: true, status: 'no_content', tribunais: enabledTribunais };
    return { itemsFound: 0, metadata: { status: 'no_content' } };
  }

  // 4. Enriquece cada item (dispositivos TCU + AI bullets)
  const renderedGroups: ClippingGroup[] = [];
  for (const code of enabledTribunais) {
    const items = groups.get(code);
    if (!items || items.length === 0) continue;
    const enriched: ClippingItemRendered[] = [];
    for (const item of items) {
      const r = await enrichItem(item);
      enriched.push(r);
    }
    renderedGroups.push({
      tribunalCode: code,
      tribunalName: items[0].tribunalName,
      items: enriched,
    });
  }

  // 5. Destinatários
  const allRecipients = await getClippingRecipients();
  const filteredByBeta = applyBetaFilter(allRecipients, process.env.CLIPPING_BETA_EMAILS);
  const adminRecipients = getAdminRecipientsFromEnv();
  const recipients = mergeAdminRecipients(filteredByBeta, adminRecipients);

  console.log(`[DailyClipping] ${recipients.length} destinatários (alunos=${filteredByBeta.length}, admins=${adminRecipients.length}, beta=${process.env.CLIPPING_BETA_EMAILS ? 'on' : 'off'})`);

  const sentDateParam = formatSentDateParam(sentDateKey);
  const viewToken = signViewToken(sentDateParam);
  const showArchiveBanner = process.env.CLIPPING_NEW_FEATURE_BANNER === 'true';

  // 6. Payload polimórfico para histórico (achata grupos)
  const allItems: ClippingItem[] = [];
  for (const g of renderedGroups) allItems.push(...g.items.map((r) => r.item));
  const sentItemsPayload = buildSentItemsPayload(allItems);

  if (dryRun) {
    const sample = recipients[0]
      ? renderDailyClippingV2({
          sendId: 'dry-run',
          recipientName: recipients[0].name,
          unsubscribeToken: signUnsubscribeToken(recipients[0].userId),
          referenceDate,
          groups: renderedGroups,
          viewToken,
          sentDateParam,
          showArchiveBanner,
        })
      : null;
    responseBody = {
      ok: true,
      dryRun: true,
      tribunais: enabledTribunais,
      itemsByTribunal: Object.fromEntries(
        renderedGroups.map((g) => [g.tribunalCode, g.items.length])
      ),
      totalItems,
      recipientCount: recipients.length,
      sampleHtmlLength: sample?.html.length || 0,
      subject: sample?.subject,
      sentItemsPayloadSample: sentItemsPayload.slice(0, 200),
    };
    return { itemsFound: totalItems, metadata: { dryRun: true } };
  }

  // 7. Persiste send ANTES de enviar (idempotência da janela)
  const sendId = randomUUID();
  const sendRecord = await prisma.dailyClippingSend.upsert({
    where: { sentDate: sentDateKey },
    create: {
      id: sendId,
      sentDate: sentDateKey,
      status: 'partial',
      startedAt,
      acordaoCount: totalItems,
      acordaoIdsIncluded: sentItemsPayload,
      totalRecipients: recipients.length,
    },
    update: {
      status: 'partial',
      startedAt,
      acordaoCount: totalItems,
      acordaoIdsIncluded: sentItemsPayload,
      totalRecipients: recipients.length,
      errorMessage: null,
      finishedAt: null,
    },
  });

  // 8. Envio
  let totalSent = 0;
  let totalFailed = 0;
  let lastError: string | null = null;

  for (const r of recipients) {
    try {
      const token = signUnsubscribeToken(r.userId);
      const rendered = renderDailyClippingV2({
        sendId: sendRecord.id,
        recipientName: r.name,
        unsubscribeToken: token,
        referenceDate,
        groups: renderedGroups,
        viewToken,
        sentDateParam,
        showArchiveBanner,
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

      responseBody = {
        ok: finalStatus !== 'failed',
        status: finalStatus,
        sendId: sendRecord.id,
        tribunais: enabledTribunais,
        itemsByTribunal: Object.fromEntries(
          renderedGroups.map((g) => [g.tribunalCode, g.items.length])
        ),
        totalItems,
        totalSent,
        totalFailed,
        totalRecipients: recipients.length,
      };
      return {
        itemsFound: totalItems,
        itemsNew: totalSent,
        itemsError: totalFailed,
        metadata: { sendId: sendRecord.id, status: finalStatus },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
