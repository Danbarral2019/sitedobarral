/**
 * Auditoria de saúde das URLs externas dos LegislativeAct.
 *
 * Faz HEAD request em officialUrl + pdfUrl de cada ato e reporta:
 * - 4xx/5xx (URL morta — link quebrado na UI)
 * - timeouts
 * - DNS failures
 * - redirects (3xx — funciona mas pode indicar URL movida; reportar p/ followup)
 *
 * Servidores com agressividade anti-bot (Planalto, gov.br) podem retornar
 * 403 em HEAD mesmo quando GET funciona — fallback para GET com header
 * Range pra economizar bytes.
 *
 * Read-only — só reporta. Concorrência limitada (10 paralelos) pra não
 * martelar servidores legados.
 *
 * Modos: --pdf-only | --official-only | (default: ambos)
 */
import { prisma } from '../lib/prisma';

interface UrlCheck {
  actId: string;
  fullNumber: string;
  field: 'officialUrl' | 'pdfUrl';
  url: string;
  status: number | 'TIMEOUT' | 'DNS' | 'NETWORK' | 'OK';
  finalUrl?: string;
  redirected: boolean;
  ms: number;
}

const TIMEOUT_MS = 10_000;
const CONCURRENCY = 10;
const USER_AGENT = 'Mozilla/5.0 (compatible; sitedobarral-audit/1.0)';

async function checkUrl(url: string): Promise<Omit<UrlCheck, 'actId' | 'fullNumber' | 'field'>> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  // Tentativa 1: HEAD
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    clearTimeout(timer);
    const ms = Date.now() - start;
    if (res.status === 405 || res.status === 403) {
      // Server bloqueia HEAD — tenta GET com Range header
      return await checkUrlWithGetRange(url, start);
    }
    return {
      url,
      status: res.ok ? 'OK' : res.status,
      finalUrl: res.url !== url ? res.url : undefined,
      redirected: res.redirected,
      ms,
    };
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    const err = e as Error;
    if (err.name === 'AbortError') return { url, status: 'TIMEOUT', redirected: false, ms };
    if (err.message?.includes('ENOTFOUND') || err.message?.includes('getaddrinfo')) {
      return { url, status: 'DNS', redirected: false, ms };
    }
    return { url, status: 'NETWORK', redirected: false, ms };
  }
}

async function checkUrlWithGetRange(url: string, start: number): Promise<Omit<UrlCheck, 'actId' | 'fullNumber' | 'field'>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-1023' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    const ms = Date.now() - start;
    // Se o servidor não suporta Range vai retornar 200 com corpo cheio
    // (suficiente pra confirmar que funciona). Drena e descarta.
    res.body?.cancel().catch(() => {});
    return {
      url,
      status: res.ok ? 'OK' : res.status,
      finalUrl: res.url !== url ? res.url : undefined,
      redirected: res.redirected,
      ms,
    };
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    const err = e as Error;
    if (err.name === 'AbortError') return { url, status: 'TIMEOUT', redirected: false, ms };
    return { url, status: 'NETWORK', redirected: false, ms };
  }
}

async function runWithConcurrency<T, R>(items: T[], n: number, worker: (item: T) => Promise<R>): Promise<R[]> {
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
  const onlyPdf = process.argv.includes('--pdf-only');
  const onlyOfficial = process.argv.includes('--official-only');

  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, officialUrl: true, pdfUrl: true },
  });

  const checks: { actId: string; fullNumber: string; field: 'officialUrl' | 'pdfUrl'; url: string }[] = [];
  for (const a of acts) {
    if (!onlyPdf && a.officialUrl) checks.push({ actId: a.id, fullNumber: a.fullNumber, field: 'officialUrl', url: a.officialUrl });
    if (!onlyOfficial && a.pdfUrl) checks.push({ actId: a.id, fullNumber: a.fullNumber, field: 'pdfUrl', url: a.pdfUrl });
  }

  console.log(`📋 Verificando ${checks.length} URLs (${acts.length} atos, concorrência ${CONCURRENCY}, timeout ${TIMEOUT_MS}ms)\n`);

  const startAt = Date.now();
  let done = 0;
  const results: UrlCheck[] = await runWithConcurrency(checks, CONCURRENCY, async (c) => {
    const r = await checkUrl(c.url);
    done++;
    if (done % 25 === 0) {
      const pct = Math.round((done / checks.length) * 100);
      console.log(`   ${done}/${checks.length} (${pct}%)`);
    }
    return { ...c, ...r };
  });
  const elapsed = ((Date.now() - startAt) / 1000).toFixed(1);

  // Agregação
  const byStatus = new Map<string, UrlCheck[]>();
  for (const r of results) {
    const key = String(r.status);
    const arr = byStatus.get(key) ?? [];
    arr.push(r);
    byStatus.set(key, arr);
  }

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 ${checks.length} URLs verificadas em ${elapsed}s`);
  console.log(`\nPor status:`);
  const sorted = [...byStatus.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [status, items] of sorted) {
    const tag = status === 'OK' ? '✅' : '❌';
    console.log(`   ${tag} ${status.padEnd(15)} ${items.length}`);
  }

  // Detalhe de problemas
  const problems = results.filter((r) => r.status !== 'OK');
  if (problems.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`❌ ${problems.length} URLs com problema:\n`);
    for (const p of problems) {
      console.log(`   [${p.status}] ${p.fullNumber} (${p.field})`);
      console.log(`      ${p.url}`);
      if (p.finalUrl) console.log(`      → ${p.finalUrl}`);
    }
  }

  // Redirects (200 OK mas URL mudou)
  const redirected = results.filter((r) => r.status === 'OK' && r.redirected && r.finalUrl);
  if (redirected.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🔀 ${redirected.length} URLs redirecionadas (originais funcionam mas foram movidas):\n`);
    for (const r of redirected.slice(0, 30)) {
      console.log(`   ${r.fullNumber} (${r.field}):`);
      console.log(`      ${r.url}`);
      console.log(`      → ${r.finalUrl}`);
    }
    if (redirected.length > 30) console.log(`   ... +${redirected.length - 30} outras`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
