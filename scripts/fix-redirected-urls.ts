/**
 * Atualiza officialUrl/pdfUrl que sofreram redirect 3xx pro destino final.
 *
 * Por que: redirects silentes hoje viram links mortos amanhã (servidor
 * remove o redirect e a URL antiga retorna 404). Capturar a URL canônica
 * agora previne esse rot.
 *
 * Cobre:
 * - Capitalização do Planalto: D12345.htm → d12345.htm, _Ato → _ato
 * - Mudanças de path do gov.br/compras (ex: IN SEGES/MGI 52/2025 que
 *   mudou de /compras/.../in-...-1 pra /contratamaisbrasil/.../in-...)
 *
 * Conservador: só atualiza quando o destino final retorna OK e o redirect
 * é estável (não circular, não loop).
 *
 * Modos: dry-run | --apply
 */
import { prisma } from '../lib/prisma';
import { CacheInvalidation } from '../lib/cache/redis-client';

const TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;
const USER_AGENT = 'Mozilla/5.0 (compatible; sitedobarral-audit/1.0)';

interface UrlUpdate {
  actId: string;
  fullNumber: string;
  field: 'officialUrl' | 'pdfUrl';
  before: string;
  after: string;
  status: number | string;
}

async function resolveFinalUrl(url: string): Promise<{ finalUrl: string; status: number | string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    // Se HEAD foi bloqueado (403/405), tenta GET com Range
    if (res.status === 403 || res.status === 405) {
      res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-1023' },
        redirect: 'follow',
      });
      res.body?.cancel().catch(() => {});
    }
    clearTimeout(timer);
    if (!res.ok) return { finalUrl: url, status: res.status };
    return { finalUrl: res.url, status: res.status };
  } catch (e) {
    clearTimeout(timer);
    return { finalUrl: url, status: (e as Error).name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  }
}

async function runConcurrent<T, R>(items: T[], n: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function next(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, next));
  return results;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, officialUrl: true, pdfUrl: true },
  });

  type Check = { actId: string; fullNumber: string; field: 'officialUrl' | 'pdfUrl'; url: string };
  const checks: Check[] = [];
  for (const a of acts) {
    if (a.officialUrl) checks.push({ actId: a.id, fullNumber: a.fullNumber, field: 'officialUrl', url: a.officialUrl });
    if (a.pdfUrl) checks.push({ actId: a.id, fullNumber: a.fullNumber, field: 'pdfUrl', url: a.pdfUrl });
  }

  console.log(`📋 Resolvendo ${checks.length} URLs (${acts.length} atos, concorrência ${CONCURRENCY})\n`);

  let done = 0;
  const updates: UrlUpdate[] = [];
  const failures: { check: Check; status: number | string }[] = [];

  await runConcurrent(checks, CONCURRENCY, async (c) => {
    const r = await resolveFinalUrl(c.url);
    done++;
    if (done % 25 === 0) console.log(`   ${done}/${checks.length}`);
    if (!r) return;
    if (typeof r.status === 'number' && r.status >= 200 && r.status < 300) {
      if (r.finalUrl !== c.url) {
        updates.push({
          actId: c.actId,
          fullNumber: c.fullNumber,
          field: c.field,
          before: c.url,
          after: r.finalUrl,
          status: r.status,
        });
      }
    } else {
      failures.push({ check: c, status: r.status });
    }
  });

  console.log(`\n📊 Resumo:`);
  console.log(`   URLs com redirect resolvido: ${updates.length}`);
  console.log(`   URLs com falha (timeout/4xx/5xx): ${failures.length}`);

  // Categoriza updates: capitalização vs path real
  const cosmetic = updates.filter((u) => u.before.toLowerCase() === u.after.toLowerCase());
  const realPath = updates.filter((u) => u.before.toLowerCase() !== u.after.toLowerCase());
  console.log(`     - cosméticas (só case): ${cosmetic.length}`);
  console.log(`     - mudança real de path: ${realPath.length}`);

  if (realPath.length > 0) {
    console.log(`\n⚠️  Mudanças REAIS de path (revisar manualmente!):`);
    for (const u of realPath) {
      console.log(`   ${u.fullNumber} (${u.field}):`);
      console.log(`     ANTES:  ${u.before}`);
      console.log(`     DEPOIS: ${u.after}`);
    }
  }

  if (failures.length > 0) {
    console.log(`\n❌ Falhas:`);
    for (const f of failures) {
      console.log(`   [${f.status}] ${f.check.fullNumber} (${f.check.field}): ${f.check.url}`);
    }
  }

  if (!apply) {
    console.log(`\n🔒 dry-run. Use --apply pra gravar as ${updates.length} mudanças.`);
    await prisma.$disconnect();
    return;
  }

  if (updates.length === 0) {
    console.log(`\n✅ Sem mudanças.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n💾 Aplicando ${updates.length} updates...`);
  // Group by actId pra fazer 1 update por ato (em vez de 1 por field)
  const byAct = new Map<string, UrlUpdate[]>();
  for (const u of updates) {
    const arr = byAct.get(u.actId) ?? [];
    arr.push(u);
    byAct.set(u.actId, arr);
  }
  let written = 0;
  for (const [actId, ups] of byAct) {
    const data: { officialUrl?: string; pdfUrl?: string } = {};
    for (const u of ups) data[u.field] = u.after;
    await prisma.legislativeAct.update({ where: { id: actId }, data });
    written++;
    if (written % 25 === 0) console.log(`   ${written}/${byAct.size}...`);
  }
  console.log(`✅ ${written} atos atualizados.`);

  await CacheInvalidation.legislativeActs();
  console.log(`🔄 Cache invalidado.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
