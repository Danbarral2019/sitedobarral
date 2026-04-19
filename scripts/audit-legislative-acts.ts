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
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
