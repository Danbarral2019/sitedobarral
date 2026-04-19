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
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
