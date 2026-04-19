/**
 * Audit diagnóstico de LegislativeAct.
 * Read-only. Produz relatório markdown + dump JSON em docs/audits/.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --skip-fetch
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --spot-check-limit=20
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as fs from 'node:fs';
import * as path from 'node:path';

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error('DATABASE_URL not set. Run `vercel env pull .env.local` first.');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

// ── CLI args ──────────────────────────────────────────────────────────────

function parseIntArg(name: string, defaultValue: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return defaultValue;
  const value = parseInt(arg.split('=')[1], 10);
  return Number.isFinite(value) ? value : defaultValue;
}

const SPOT_CHECK_LIMIT = parseIntArg('spot-check-limit', 12);
const SKIP_FETCH = process.argv.includes('--skip-fetch');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Types ─────────────────────────────────────────────────────────────────

type ContentBucket = 'missing' | '0' | '<500' | '500-2000' | '2000-5000' | '>5000';

interface InventoryRow { issuer: string; type: string; count: number; }
interface ContentLengthRow { issuer: string; bucket: ContentBucket; count: number; }
interface ScrapeStatusRow { issuer: string; status: string; count: number; lastScrapedAgoDays: number | null; }

interface AuditReport {
  generatedAt: string;
  total: number;
  inventory: InventoryRow[];
  contentLength: ContentLengthRow[];
  scrapeStatus: ScrapeStatusRow[];
  hostDistribution?: HostRow[];
  metadataCompleteness?: MetadataRow[];
  duplicates?: DuplicateGroup[];
  samples?: ContentSample[];
  spotCheck?: SpotCheckRow[];
  problemIds: ProblemIdIndex;
}

interface ProblemIdIndex {
  contentMissing: string[];
  contentTruncated: string[];
  metadataIncomplete: string[];
  duplicateCandidates: string[];
  unparsedHost: string[];
  spotCheckSuspicious: string[];
}

// Stubs — preenchidos em tasks posteriores (Tasks 3-4). Declarados aqui para
// que AuditReport compile.
interface HostRow { host: string; count: number; hasParser: boolean; }
interface MetadataRow { issuer: string; field: string; filledPct: number; filledCount: number; totalCount: number; }
interface DuplicateGroup { issuer: string; type: string; number: string; year: number; count: number; ids: string[]; fullNumbers: string[]; }
interface ContentSample { issuer: string; fullNumber: string; id: string; contentLength: number; head: string; tail: string; }
interface SpotCheckRow {
  id: string;
  fullNumber: string;
  issuer: string;
  officialUrl: string;
  httpStatus: number | null;
  fetchError: string | null;
  rawHtmlBytes: number | null;
  strippedTextLength: number | null;
  storedContentLength: number;
  ratio: number | null;
  verdict: 'ok' | 'truncated' | 'bloated' | 'url-dead' | 'skipped';
}

// ── Constants ────────────────────────────────────────────────────────────

const SPOT_CHECK_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 30000;
const TRUNCATED_RATIO = 0.5;
const BLOATED_RATIO = 1.5;
const HEALTHY_MIN_LEN = 3000;

// ── Helpers ───────────────────────────────────────────────────────────────

function bucketContentLength(len: number | null | undefined): ContentBucket {
  if (len === null || len === undefined) return 'missing';
  if (len === 0) return '0';
  if (len < 500) return '<500';
  if (len < 2000) return '500-2000';
  if (len < 5000) return '2000-5000';
  return '>5000';
}

/**
 * Hosts que têm parser dedicado em scripts/scrape-legislative-acts-content.ts.
 * Atualizar se novos parsers forem adicionados.
 */
const HOSTS_WITH_PARSER = new Set<string>([
  'www.planalto.gov.br',
  'planalto.gov.br',
  // Qualquer subdomínio de gov.br (exceto os acima) cai no parser genérico gov.br
]);

function extractHost(url: string | null | undefined): string {
  if (!url) return '(sem officialUrl)';
  try {
    return new URL(url).hostname;
  } catch {
    return '(URL inválida)';
  }
}

function hostHasParser(host: string): boolean {
  if (HOSTS_WITH_PARSER.has(host)) return true;
  // extractGovBr aceita qualquer *.gov.br
  if (host.endsWith('.gov.br') || host === 'gov.br') return true;
  return false;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<(p|div|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchOnce(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ status: number; bodyBytes: number; text: string } | { error: string }> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SiteDoBarral-Audit/1.0 (+https://profdanielbarral.com)',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    const buffer = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || '';
    const charset = ct.match(/charset=([^\s;]+)/i)?.[1]?.toLowerCase();
    const isLatin1 = charset === 'iso-8859-1' || charset === 'latin1' || charset === 'latin-1';
    const isGovBr = /(^|\.)gov\.br$/.test(new URL(url).hostname);
    const decoder = new TextDecoder(
      isLatin1 || (!charset && isGovBr) ? 'iso-8859-1' : 'utf-8',
    );
    const text = decoder.decode(buffer);
    return { status: res.status, bodyBytes: buffer.byteLength, text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(to);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Queries ───────────────────────────────────────────────────────────────

async function queryInventory(): Promise<InventoryRow[]> {
  const grouped = await prisma.legislativeAct.groupBy({
    by: ['issuer', 'type'],
    _count: { _all: true },
    orderBy: [{ issuer: 'asc' }, { type: 'asc' }],
  });
  return grouped.map((g) => ({ issuer: g.issuer, type: g.type, count: g._count._all }));
}

async function queryContentLength(): Promise<ContentLengthRow[]> {
  // Busca todos os issuer + content.length. Como Prisma não tem length() no groupBy,
  // fazemos fetch mínimo e agregamos em memória (108 atos é trivial).
  const acts = await prisma.legislativeAct.findMany({
    select: { issuer: true, content: true },
  });

  const map = new Map<string, Map<ContentBucket, number>>();
  for (const act of acts) {
    const bucket = bucketContentLength(act.content?.length ?? null);
    if (!map.has(act.issuer)) map.set(act.issuer, new Map());
    const inner = map.get(act.issuer)!;
    inner.set(bucket, (inner.get(bucket) ?? 0) + 1);
  }

  const rows: ContentLengthRow[] = [];
  for (const [issuer, buckets] of map) {
    for (const [bucket, count] of buckets) {
      rows.push({ issuer, bucket, count });
    }
  }
  return rows.sort((a, b) => a.issuer.localeCompare(b.issuer) || a.bucket.localeCompare(b.bucket));
}

async function queryScrapeStatus(): Promise<ScrapeStatusRow[]> {
  const acts = await prisma.legislativeAct.findMany({
    select: { issuer: true, scrapeStatus: true, lastScrapedAt: true },
  });

  const map = new Map<string, Map<string, { count: number; latest: Date | null }>>();
  const now = Date.now();

  for (const act of acts) {
    const status = act.scrapeStatus ?? 'null';
    if (!map.has(act.issuer)) map.set(act.issuer, new Map());
    const inner = map.get(act.issuer)!;
    const prev = inner.get(status) ?? { count: 0, latest: null };
    const actDate = act.lastScrapedAt;
    const latest = !prev.latest || (actDate && actDate > prev.latest) ? actDate : prev.latest;
    inner.set(status, { count: prev.count + 1, latest });
  }

  const rows: ScrapeStatusRow[] = [];
  for (const [issuer, statuses] of map) {
    for (const [status, v] of statuses) {
      const ageDays = v.latest ? Math.floor((now - v.latest.getTime()) / 86400000) : null;
      rows.push({ issuer, status, count: v.count, lastScrapedAgoDays: ageDays });
    }
  }
  return rows.sort((a, b) => a.issuer.localeCompare(b.issuer) || a.status.localeCompare(b.status));
}

async function queryHostDistribution(): Promise<HostRow[]> {
  const acts = await prisma.legislativeAct.findMany({
    select: { officialUrl: true },
  });
  const map = new Map<string, number>();
  for (const act of acts) {
    const host = extractHost(act.officialUrl);
    map.set(host, (map.get(host) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([host, count]) => ({ host, count, hasParser: hostHasParser(host) }))
    .sort((a, b) => b.count - a.count);
}

async function queryMetadataCompleteness(): Promise<MetadataRow[]> {
  const acts = await prisma.legislativeAct.findMany({
    select: {
      issuer: true,
      number: true,
      year: true,
      fullNumber: true,
      publishDate: true,
      ementa: true,
      officialUrl: true,
      content: true,
      themes: true,
      leiArticles: true,
    },
  });

  const fields = ['number', 'year', 'fullNumber', 'publishDate', 'ementa', 'officialUrl', 'content', 'themes', 'leiArticles'] as const;
  const byIssuer = new Map<string, Map<string, { filled: number; total: number }>>();

  for (const act of acts) {
    if (!byIssuer.has(act.issuer)) {
      const inner = new Map<string, { filled: number; total: number }>();
      for (const f of fields) inner.set(f, { filled: 0, total: 0 });
      byIssuer.set(act.issuer, inner);
    }
    const inner = byIssuer.get(act.issuer)!;
    for (const f of fields) {
      const v = (act as Record<string, unknown>)[f];
      const filled = v !== null && v !== undefined && v !== '';
      const prev = inner.get(f)!;
      inner.set(f, { filled: prev.filled + (filled ? 1 : 0), total: prev.total + 1 });
    }
  }

  const rows: MetadataRow[] = [];
  for (const [issuer, fieldMap] of byIssuer) {
    for (const [field, v] of fieldMap) {
      const pct = v.total === 0 ? 0 : Math.round((v.filled / v.total) * 100);
      rows.push({ issuer, field, filledPct: pct, filledCount: v.filled, totalCount: v.total });
    }
  }
  return rows.sort((a, b) => a.issuer.localeCompare(b.issuer) || a.field.localeCompare(b.field));
}

async function queryDuplicates(): Promise<DuplicateGroup[]> {
  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, issuer: true, type: true, number: true, year: true, fullNumber: true },
  });
  const map = new Map<string, { issuer: string; type: string; number: string; year: number; ids: string[]; fullNumbers: string[] }>();
  for (const act of acts) {
    const key = `${act.issuer}|${act.type}|${act.number}|${act.year}`;
    if (!map.has(key)) {
      map.set(key, { issuer: act.issuer, type: act.type, number: act.number, year: act.year, ids: [], fullNumbers: [] });
    }
    const group = map.get(key)!;
    group.ids.push(act.id);
    group.fullNumbers.push(act.fullNumber);
  }
  return Array.from(map.values())
    .filter((g) => g.ids.length > 1)
    .map((g) => ({ ...g, count: g.ids.length }))
    .sort((a, b) => b.count - a.count);
}

async function queryContentSamples(): Promise<ContentSample[]> {
  // Top 5 issuers por contagem
  const top = await prisma.legislativeAct.groupBy({
    by: ['issuer'],
    _count: { _all: true },
    orderBy: { _count: { issuer: 'desc' } },
    take: 5,
  });

  const samples: ContentSample[] = [];
  for (const t of top) {
    const acts = await prisma.legislativeAct.findMany({
      where: { issuer: t.issuer, content: { not: null } },
      select: { id: true, fullNumber: true, issuer: true, content: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    for (const act of acts) {
      const c = act.content ?? '';
      if (c.length === 0) continue;
      samples.push({
        issuer: act.issuer,
        fullNumber: act.fullNumber,
        id: act.id,
        contentLength: c.length,
        head: c.slice(0, 300),
        tail: c.length > 600 ? c.slice(-300) : '',
      });
    }
  }
  return samples;
}

function computeVerdict(status: number, storedLen: number, strippedLen: number): SpotCheckRow['verdict'] {
  if (status >= 400) return 'url-dead';
  if (storedLen === 0) return 'truncated';
  if (strippedLen === 0) return 'ok'; // can't compute ratio; caller may want to flag separately
  const ratio = storedLen / strippedLen;
  if (ratio < TRUNCATED_RATIO) return 'truncated';
  if (ratio > BLOATED_RATIO) return 'bloated';
  return 'ok';
}

async function runSpotCheck(limit: number): Promise<SpotCheckRow[]> {
  // Seleção: prioriza suspeitos (content.length < 1000 E officialUrl presente),
  // + 2 "saudáveis" (content.length > 3000) como controle.
  const suspicious = await prisma.legislativeAct.findMany({
    where: {
      officialUrl: { not: null },
      OR: [{ content: null }, { content: '' }],
    },
    select: { id: true, fullNumber: true, issuer: true, officialUrl: true, content: true },
    take: Math.max(0, limit - 2),
  });

  if (suspicious.length < limit - 2) {
    const extra = await prisma.legislativeAct.findMany({
      where: {
        officialUrl: { not: null },
        id: { notIn: suspicious.map((s) => s.id) },
      },
      select: { id: true, fullNumber: true, issuer: true, officialUrl: true, content: true },
      take: (limit - 2) - suspicious.length,
      orderBy: { createdAt: 'desc' },
    });
    suspicious.push(...extra);
  }

  const healthy = await prisma.legislativeAct.findMany({
    where: {
      officialUrl: { not: null },
      content: { not: null },
      id: { notIn: suspicious.map((s) => s.id) },
    },
    select: { id: true, fullNumber: true, issuer: true, officialUrl: true, content: true },
    take: 2,
    orderBy: { createdAt: 'desc' },
  });

  const all = [...suspicious, ...healthy.filter((h) => (h.content?.length ?? 0) > HEALTHY_MIN_LEN)].slice(0, limit);
  const results: SpotCheckRow[] = [];

  for (let i = 0; i < all.length; i++) {
    const act = all[i];
    const stored = act.content?.length ?? 0;
    console.log(`  fetching ${act.fullNumber} → ${act.officialUrl}`);
    const r = await fetchOnce(act.officialUrl!);

    if ('error' in r) {
      results.push({
        id: act.id,
        fullNumber: act.fullNumber,
        issuer: act.issuer,
        officialUrl: act.officialUrl!,
        httpStatus: null,
        fetchError: r.error,
        rawHtmlBytes: null,
        strippedTextLength: null,
        storedContentLength: stored,
        ratio: null,
        verdict: 'url-dead',
      });
    } else {
      const stripped = stripHtml(r.text);
      const ratio = stripped.length === 0 ? null : stored / stripped.length;
      const verdict = computeVerdict(r.status, stored, stripped.length);

      results.push({
        id: act.id,
        fullNumber: act.fullNumber,
        issuer: act.issuer,
        officialUrl: act.officialUrl!,
        httpStatus: r.status,
        fetchError: null,
        rawHtmlBytes: r.bodyBytes,
        strippedTextLength: stripped.length,
        storedContentLength: stored,
        ratio,
        verdict,
      });
    }

    if (i < all.length - 1) await sleep(SPOT_CHECK_DELAY_MS); // delay entre fetches (pulado no último)
  }

  return results;
}

async function buildProblemIdIndex(params: {
  duplicates: DuplicateGroup[];
  spotCheck: SpotCheckRow[];
}): Promise<ProblemIdIndex> {
  // contentMissing: content null ou vazio
  const missing = await prisma.legislativeAct.findMany({
    where: { OR: [{ content: null }, { content: '' }] },
    select: { id: true },
  });

  // contentTruncated: content < 500 chars mas officialUrl presente
  const truncated = await prisma.legislativeAct.findMany({
    where: { officialUrl: { not: null }, content: { not: null } },
    select: { id: true, content: true },
  });
  const truncatedIds = truncated
    .filter((a) => (a.content?.length ?? 0) < 500)
    .map((a) => a.id);

  // metadataIncomplete: falta qualquer um de (number, ementa, officialUrl)
  // year (Int) and publishDate (DateTime) can't be OR-compared to ''.
  // Section 5 (metadataCompleteness) tracks their fill rate separately.
  const incomplete = await prisma.legislativeAct.findMany({
    where: {
      OR: [{ number: '' }, { ementa: '' }, { officialUrl: null }],
    },
    select: { id: true },
  });

  // unparsedHost: atos com officialUrl cujo host NÃO tem parser
  const allWithUrl = await prisma.legislativeAct.findMany({
    where: { officialUrl: { not: null } },
    select: { id: true, officialUrl: true },
  });
  const unparsedIds = allWithUrl
    .filter((a) => !hostHasParser(extractHost(a.officialUrl)))
    .map((a) => a.id);

  return {
    contentMissing: missing.map((a) => a.id),
    contentTruncated: truncatedIds,
    metadataIncomplete: incomplete.map((a) => a.id),
    duplicateCandidates: params.duplicates.flatMap((g) => g.ids),
    unparsedHost: unparsedIds,
    spotCheckSuspicious: params.spotCheck
      .filter((r) => r.verdict === 'truncated' || r.verdict === 'bloated')
      .map((r) => r.id),
  };
}

// ── Markdown renderer ─────────────────────────────────────────────────────

function renderMarkdown(r: AuditReport): string {
  const lines: string[] = [];
  lines.push(`# Auditoria de LegislativeActs`);
  lines.push(``);
  lines.push(`**Gerado em:** ${r.generatedAt}`);
  lines.push(`**Total de atos:** ${r.total}`);
  lines.push(``);

  lines.push(`## 1. Inventário por (issuer, type)`);
  lines.push(``);
  lines.push(`| Issuer | Type | Count |`);
  lines.push(`|---|---|---:|`);
  for (const row of r.inventory) lines.push(`| ${row.issuer} | ${row.type} | ${row.count} |`);
  lines.push(``);

  lines.push(`## 2. Distribuição de content.length por issuer`);
  lines.push(``);
  lines.push(`| Issuer | Bucket | Count |`);
  lines.push(`|---|---|---:|`);
  for (const row of r.contentLength) lines.push(`| ${row.issuer} | ${row.bucket} | ${row.count} |`);
  lines.push(``);

  lines.push(`## 3. scrapeStatus por issuer`);
  lines.push(``);
  lines.push(`| Issuer | Status | Count | Último scrape |`);
  lines.push(`|---|---|---:|---|`);
  for (const row of r.scrapeStatus) {
    const age = row.lastScrapedAgoDays !== null ? `${row.lastScrapedAgoDays}d atrás` : 'nunca';
    lines.push(`| ${row.issuer} | ${row.status} | ${row.count} | ${age} |`);
  }
  lines.push(``);

  if (r.hostDistribution) {
    lines.push(`## 4. Hosts de officialUrl`);
    lines.push(``);
    lines.push(`| Host | Count | Parser dedicado |`);
    lines.push(`|---|---:|---|`);
    for (const row of r.hostDistribution) {
      lines.push(`| \`${row.host}\` | ${row.count} | ${row.hasParser ? '✓' : '✗ fallback'} |`);
    }
    lines.push(``);
  }

  if (r.metadataCompleteness) {
    lines.push(`## 5. Completude de metadados por issuer`);
    lines.push(``);
    lines.push(`| Issuer | Campo | % preenchido | Filled/Total |`);
    lines.push(`|---|---|---:|---|`);
    for (const row of r.metadataCompleteness) {
      lines.push(`| ${row.issuer} | ${row.field} | ${row.filledPct}% | ${row.filledCount}/${row.totalCount} |`);
    }
    lines.push(``);
  }

  if (r.duplicates) {
    lines.push(`## 6. Duplicatas candidatas`);
    lines.push(``);
    if (r.duplicates.length === 0) {
      lines.push(`Nenhuma.`);
    } else {
      for (const g of r.duplicates) {
        lines.push(`- **[${g.issuer}] ${g.type} ${g.number}/${g.year}** — ${g.count} ocorrências:`);
        for (const fn of g.fullNumbers) lines.push(`  - ${fn}`);
      }
    }
    lines.push(``);
  }

  if (r.samples) {
    lines.push(`## 7. Amostras de conteúdo (top 5 issuers × 3 atos)`);
    lines.push(``);
    for (const s of r.samples) {
      lines.push(`### [${s.issuer}] ${s.fullNumber} — ${s.contentLength} chars`);
      lines.push(``);
      lines.push(`**HEAD:**`);
      lines.push('```');
      lines.push(s.head);
      lines.push('```');
      if (s.tail) {
        lines.push(`**TAIL:**`);
        lines.push('```');
        lines.push(s.tail);
        lines.push('```');
      }
      lines.push(``);
    }
  }

  if (r.spotCheck && r.spotCheck.length > 0) {
    lines.push(`## 8. Spot-check de URLs`);
    lines.push(``);
    lines.push(`| fullNumber | Issuer | HTTP | Stored | Stripped | Ratio | Verdict |`);
    lines.push(`|---|---|---:|---:|---:|---:|---|`);
    for (const r2 of r.spotCheck) {
      const http = r2.httpStatus ?? 'ERR';
      const stripped = r2.strippedTextLength ?? '—';
      const ratio = r2.ratio !== null ? r2.ratio.toFixed(2) : '—';
      lines.push(`| ${r2.fullNumber} | ${r2.issuer} | ${http} | ${r2.storedContentLength} | ${stripped} | ${ratio} | ${r2.verdict} |`);
    }
    lines.push(``);
  }

  lines.push(`## Problem IDs (para consumo pelo fix)`);
  lines.push(``);
  lines.push(`- \`contentMissing\`: ${r.problemIds.contentMissing.length} atos`);
  lines.push(`- \`contentTruncated\`: ${r.problemIds.contentTruncated.length} atos`);
  lines.push(`- \`metadataIncomplete\`: ${r.problemIds.metadataIncomplete.length} atos`);
  lines.push(`- \`duplicateCandidates\`: ${r.problemIds.duplicateCandidates.length} atos`);
  lines.push(`- \`unparsedHost\`: ${r.problemIds.unparsedHost.length} atos`);
  lines.push(`- \`spotCheckSuspicious\`: ${r.problemIds.spotCheckSuspicious.length} atos`);
  lines.push(``);
  lines.push(`Lista completa de IDs no arquivo JSON gerado junto com este relatório.`);

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Audit de LegislativeAct ===');
  console.log(`Spot-check limit: ${SPOT_CHECK_LIMIT}`);
  console.log(`Skip fetch: ${SKIP_FETCH}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  const total = await prisma.legislativeAct.count();
  console.log(`Total de atos: ${total}\n`);

  console.log('— Seção 1: Inventário por (issuer, type) —');
  const inventory = await queryInventory();
  for (const row of inventory) {
    console.log(`  [${row.issuer}] ${row.type}: ${row.count}`);
  }

  console.log('\n— Seção 2: Distribuição de content.length por issuer —');
  const contentLength = await queryContentLength();
  for (const row of contentLength) {
    console.log(`  [${row.issuer}] ${row.bucket}: ${row.count}`);
  }

  console.log('\n— Seção 3: scrapeStatus por issuer —');
  const scrapeStatus = await queryScrapeStatus();
  for (const row of scrapeStatus) {
    const age = row.lastScrapedAgoDays !== null ? `${row.lastScrapedAgoDays}d atrás` : 'nunca';
    console.log(`  [${row.issuer}] ${row.status}: ${row.count} (último: ${age})`);
  }

  console.log('\n— Seção 4: Hosts de officialUrl —');
  const hosts = await queryHostDistribution();
  for (const row of hosts) {
    const flag = row.hasParser ? '✓ parser' : '✗ fallback';
    console.log(`  ${row.host}: ${row.count} (${flag})`);
  }

  console.log('\n— Seção 5: Completude de metadados por issuer —');
  const metadata = await queryMetadataCompleteness();
  for (const row of metadata) {
    console.log(`  [${row.issuer}] ${row.field}: ${row.filledPct}% (${row.filledCount}/${row.totalCount})`);
  }

  console.log('\n— Seção 6: Duplicatas candidatas —');
  const duplicates = await queryDuplicates();
  if (duplicates.length === 0) {
    console.log('  Nenhuma.');
  } else {
    for (const g of duplicates) {
      console.log(`  [${g.issuer}] ${g.type} ${g.number}/${g.year}: ${g.count} ocorrências`);
      for (const fn of g.fullNumbers) console.log(`    - ${fn}`);
    }
  }

  console.log('\n— Seção 7: Amostras de conteúdo (top 5 issuers × 3 atos) —');
  const samples = await queryContentSamples();
  for (const s of samples) {
    console.log(`\n  [${s.issuer}] ${s.fullNumber} (${s.contentLength} chars)`);
    console.log(`    HEAD: ${s.head.replace(/\n/g, ' ⏎ ').slice(0, 200)}...`);
    if (s.tail) console.log(`    TAIL: ...${s.tail.replace(/\n/g, ' ⏎ ').slice(-200)}`);
  }

  let spotCheck: SpotCheckRow[] = [];
  if (!SKIP_FETCH) {
    console.log(`\n— Seção 8: Spot-check (até ${SPOT_CHECK_LIMIT} URLs) —`);
    spotCheck = await runSpotCheck(SPOT_CHECK_LIMIT);
    for (const r of spotCheck) {
      const ratio = r.ratio !== null ? r.ratio.toFixed(2) : 'n/a';
      console.log(`  [${r.verdict}] ${r.fullNumber}: stored=${r.storedContentLength}, stripped=${r.strippedTextLength ?? 'n/a'}, ratio=${ratio}`);
      if (r.fetchError) console.log(`    ERRO: ${r.fetchError}`);
    }
  } else {
    console.log('\n— Seção 8: Spot-check pulado (--skip-fetch) —');
  }

  // Construir relatório e índice de problemas
  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    total,
    inventory,
    contentLength,
    scrapeStatus,
    hostDistribution: hosts,
    metadataCompleteness: metadata,
    duplicates,
    samples,
    spotCheck: SKIP_FETCH ? undefined : spotCheck,
    problemIds: await buildProblemIdIndex({ duplicates, spotCheck }),
  };

  if (DRY_RUN) {
    console.log('\n[dry-run] Relatório NÃO será salvo.');
    return;
  }

  const outDir = path.join(process.cwd(), 'docs', 'audits');
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const SUFFIX_ARG = process.argv.find((a) => a.startsWith('--suffix='));
  const suffix = SUFFIX_ARG ? '-' + SUFFIX_ARG.split('=')[1] : '';
  const mdPath = path.join(outDir, `${today}-legislative-acts-audit${suffix}.md`);
  const jsonPath = path.join(outDir, `${today}-legislative-acts-audit${suffix}.json`);

  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n✓ Relatório markdown: ${mdPath}`);
  console.log(`✓ Dump JSON: ${jsonPath}`);
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
