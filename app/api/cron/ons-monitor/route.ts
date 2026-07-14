/**
 * Cron de monitoramento das Orientações Normativas da AGU.
 *
 * Raspa a página oficial (gov.br/agu/.../onsagu) — fonte autoritativa, completa e
 * atual — e a compara com o banco. Alerta no Sentry quando detecta:
 *   - ON NOVA (na página, ausente no banco) → candidata a importar;
 *   - REDAÇÃO ALTERADA (enunciado da página deixou de estar contido no content).
 * "Ausentes da página" vão só no corpo da resposta (informativo — possíveis
 * revogações), sem alerta, para não gerar ruído.
 *
 * Não grava nada: é sentinela. A atualização de fato é feita pelo
 * backfill-ons-from-agu-page.ts após revisão humana. DOU segue como detector
 * primário; este cron é a rede de segurança de reconciliação.
 *
 * Schedule em vercel.json (mensal). Auth via CRON_SECRET (verifyCronAuth).
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { decodeBest, parseOnsPage, diffOns, type DbON } from '@/lib/ons-monitor/checks';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ONS_URL = 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';

async function fetchOnsPage(): Promise<string> {
  const res = await fetch(ONS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!res.ok) throw new Error(`AGU onsagu retornou HTTP ${res.status}`);
  return decodeBest(Buffer.from(await res.arrayBuffer()));
}

/** Registros de ON do banco, deduzidos por onNumber/onYear no melhor content. */
async function loadDbOns(): Promise<DbON[]> {
  const docs = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    select: { onNumber: true, onYear: true, isPublic: true, content: true },
  });
  const byKey = new Map<string, DbON>();
  for (const d of docs) {
    if (d.onNumber == null || d.onYear == null) continue;
    const key = `${d.onNumber}/${d.onYear}`;
    const cur = byKey.get(key);
    if (!cur) byKey.set(key, { key, isPublic: !!d.isPublic, content: d.content });
    else {
      cur.isPublic = cur.isPublic || !!d.isPublic;
      if ((d.content ?? '').length > (cur.content ?? '').length) cur.content = d.content;
    }
  }
  return Array.from(byKey.values());
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('ons-monitor', async () => {
      const [html, dbOns] = await Promise.all([fetchOnsPage(), loadDbOns()]);
      const pageOns = parseOnsPage(html);

      if (pageOns.length === 0) {
        // Página mudou de estrutura ou veio vazia — não silenciar.
        Sentry.captureMessage('ons-monitor: 0 ONs parseadas da página AGU (estrutura pode ter mudado)', 'warning');
        responseBody = { ok: false, error: 'nenhuma ON parseada', pageOns: 0 };
        return { itemsFound: 0, itemsError: 1 };
      }

      const diff = diffOns(pageOns, dbOns);
      const alerts: string[] = [];
      if (diff.novasNaPagina.length > 0) {
        alerts.push(`${diff.novasNaPagina.length} ON(s) NOVA(s) na página AGU (importar): ${diff.novasNaPagina.join(', ')}`);
      }
      if (diff.redacaoAlterada.length > 0) {
        alerts.push(
          `${diff.redacaoAlterada.length} ON(s) com REDAÇÃO possivelmente ALTERADA: ` +
            diff.redacaoAlterada.map((r) => `${r.key} (contenção ${r.containment})`).join(', '),
        );
      }
      if (alerts.length > 0) {
        Sentry.captureMessage(`ons-monitor: ${alerts.join(' | ')}`, 'warning');
      }

      responseBody = {
        ok: alerts.length === 0,
        pageOns: pageOns.length,
        dbOns: dbOns.length,
        diff,
      };
      return {
        itemsFound: diff.novasNaPagina.length + diff.redacaoAlterada.length,
        itemsError: diff.novasNaPagina.length + diff.redacaoAlterada.length,
        metadata: {
          novas: diff.novasNaPagina.length,
          redacaoAlterada: diff.redacaoAlterada.length,
          ausentes: diff.ausentesDaPagina.length,
        },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
