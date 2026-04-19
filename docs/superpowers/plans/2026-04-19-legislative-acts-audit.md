# Legislative Acts Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `scripts/audit-legislative-acts.ts` — script diagnóstico read-only que produz um relatório markdown e um dump JSON sobre o estado dos `LegislativeAct` no banco, pronto para guiar os fixes de T1.

**Architecture:** Script TSX standalone (padrão de `scripts/` no projeto), conectando ao Neon via PrismaNeon adapter. Executa 7 consultas agregadas e 1 spot-check opcional via HTTP. Grava dois artefatos: `docs/audits/2026-04-19-legislative-acts-audit.md` e `.json`. Sem mutações, sem schema changes, sem tocar em outras tabelas.

**Tech Stack:** TypeScript + tsx, Prisma Client, @prisma/adapter-neon, node:fs, node:url, fetch API nativo.

**Spec de referência:** `docs/superpowers/specs/2026-04-19-legislative-acts-audit-design.md`

**Nota sobre testing:** `vitest.config.ts:48` exclui `scripts/`. Script diagnóstico read-only se valida rodando-o e inspecionando saída. Sem unit tests.

---

## File Structure

- **Create:** `scripts/audit-legislative-acts.ts` — script completo (helpers inline)
- **Create:** `docs/audits/` — pasta para relatórios de auditoria (primeira auditoria do projeto)
- **Generate (não versionado via este plan, mas gerado na execução):**
  - `docs/audits/2026-04-19-legislative-acts-audit.md`
  - `docs/audits/2026-04-19-legislative-acts-audit.json`

---

### Task 1: Skeleton, CLI args, conexão Prisma

**Files:**
- Create: `scripts/audit-legislative-acts.ts`

- [ ] **Step 1: Criar skeleton**

```typescript
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

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Audit de LegislativeAct ===');
  console.log(`Spot-check limit: ${SPOT_CHECK_LIMIT}`);
  console.log(`Skip fetch: ${SKIP_FETCH}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  const total = await prisma.legislativeAct.count();
  console.log(`Total de atos: ${total}`);
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Executar e verificar conexão**

Run:
```bash
cd "C:/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts
```

Expected: imprime o total de LegislativeActs (>=108 conforme relatório de 2026-02-23) e sai com código 0.

Se falhar com `DATABASE_URL not set`, confirmar que `.env.local` foi gerado pelo `vercel env pull` e contém a linha `DATABASE_URL=...`.

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-legislative-acts.ts
git commit -m "feat(audit): skeleton de audit-legislative-acts com CLI args"
```

---

### Task 2: Seção 1 (inventário por issuer) + Seção 2 (distribuição de content.length) + Seção 3 (scrapeStatus)

**Files:**
- Modify: `scripts/audit-legislative-acts.ts` — adicionar queries e estruturas de dados

- [ ] **Step 1: Definir tipos de relatório e helper de bucketing**

Adicione abaixo das CLI args, antes de `main()`:

```typescript
// ── Types ─────────────────────────────────────────────────────────────────

type ContentBucket = 'null' | '0' | '<500' | '500-2000' | '2000-5000' | '>5000';

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

// ── Helpers ───────────────────────────────────────────────────────────────

function bucketContentLength(len: number | null | undefined): ContentBucket {
  if (len === null || len === undefined) return 'null';
  if (len === 0) return '0';
  if (len < 500) return '<500';
  if (len < 2000) return '500-2000';
  if (len <= 5000) return '2000-5000';
  return '>5000';
}
```

- [ ] **Step 2: Implementar query de inventário**

Adicionar antes de `main()`:

```typescript
async function queryInventory(): Promise<InventoryRow[]> {
  const grouped = await prisma.legislativeAct.groupBy({
    by: ['issuer', 'type'],
    _count: { _all: true },
    orderBy: [{ issuer: 'asc' }, { type: 'asc' }],
  });
  return grouped.map((g) => ({ issuer: g.issuer, type: g.type, count: g._count._all }));
}
```

- [ ] **Step 3: Implementar query de content length**

```typescript
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
```

- [ ] **Step 4: Implementar query de scrapeStatus**

```typescript
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
```

- [ ] **Step 5: Adicionar stubs para tipos ainda não implementados**

Para o TypeScript não reclamar enquanto implementamos incrementalmente, adicione estes tipos stub (serão preenchidos em tasks posteriores):

```typescript
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
```

- [ ] **Step 6: Wire up em main() e testar**

Substitua o corpo atual de `main()` por:

```typescript
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
```

Run:
```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts
```

Expected: seções 1-3 imprimem dados reais do banco. Se houver erro TypeScript sobre tipos não usados (HostRow, etc.), é esperado — serão preenchidos nas próximas tasks.

- [ ] **Step 7: Commit**

```bash
git add scripts/audit-legislative-acts.ts
git commit -m "feat(audit): seções 1-3 (inventário, content length, scrapeStatus)"
```

---

### Task 3: Seção 4 (hosts de officialUrl) + Seção 5 (metadata) + Seção 6 (duplicatas)

**Files:**
- Modify: `scripts/audit-legislative-acts.ts`

- [ ] **Step 1: Helper `extractHost` + lista de hosts com parser**

Adicionar junto aos outros helpers:

```typescript
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
```

- [ ] **Step 2: Query de hosts**

```typescript
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
```

- [ ] **Step 3: Query de completude de metadados**

```typescript
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
```

- [ ] **Step 4: Query de duplicatas**

```typescript
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
```

- [ ] **Step 5: Wire up em main()**

Adicione ao final do `main()`:

```typescript
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
```

- [ ] **Step 6: Testar**

Run:
```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts
```

Expected: seções 4-6 imprimem dados. Atenção especial:
- Seção 4 deve marcar hosts TCU (`pesquisa.apps.tcu.gov.br`, `btcu.apps.tcu.gov.br`, `portal.tcu.gov.br`) como `✗ fallback` — esse é o achado esperado de T1.
- Seção 6 pode retornar vazio (o schema tem `fullNumber` como `@unique`, o que já previne dupla por essa chave; mas duplicatas por `(issuer, type, number, year)` com fullNumber diferente ainda podem aparecer).

- [ ] **Step 7: Commit**

```bash
git add scripts/audit-legislative-acts.ts
git commit -m "feat(audit): seções 4-6 (hosts, metadata, duplicatas)"
```

---

### Task 4: Seção 7 (amostras de conteúdo) + Seção 8 (spot-check de URLs)

**Files:**
- Modify: `scripts/audit-legislative-acts.ts`

- [ ] **Step 1: Helper `stripHtml` (copiado de scrape-legislative-acts-content.ts)**

Adicionar junto aos outros helpers:

```typescript
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
```

- [ ] **Step 2: Query de amostras**

```typescript
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
```

- [ ] **Step 3: Helper de fetch com timeout e delay**

```typescript
async function fetchOnce(url: string, timeoutMs = 30000): Promise<{ status: number; bodyBytes: number; text: string } | { error: string }> {
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SiteDoBarral-Audit/1.0 (+https://profdanielbarral.com)',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(to);
    const buffer = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || '';
    const charset = ct.match(/charset=([^\s;]+)/i)?.[1]?.toLowerCase();
    const decoder = new TextDecoder(
      charset === 'iso-8859-1' || charset === 'latin1' ? 'iso-8859-1' : 'utf-8',
    );
    const text = decoder.decode(buffer);
    return { status: res.status, bodyBytes: buffer.byteLength, text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: Query de spot-check**

```typescript
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

  const all = [...suspicious, ...healthy.filter((h) => (h.content?.length ?? 0) > 3000)].slice(0, limit);
  const results: SpotCheckRow[] = [];

  for (const act of all) {
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
      let verdict: SpotCheckRow['verdict'];
      if (r.status >= 400) verdict = 'url-dead';
      else if (stored === 0) verdict = 'truncated';
      else if (ratio !== null && ratio < 0.5) verdict = 'truncated';
      else if (ratio !== null && ratio > 1.5) verdict = 'bloated';
      else verdict = 'ok';

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

    await sleep(2000); // delay entre fetches
  }

  return results;
}
```

- [ ] **Step 5: Wire up em main()**

Adicione ao final do `main()`:

```typescript
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
```

- [ ] **Step 6: Testar sem fetch primeiro**

Run:
```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --skip-fetch
```

Expected: seções 1-7 imprimem; seção 8 diz "pulado". Inspecionar amostras (seção 7) para ver ruído.

- [ ] **Step 7: Testar com fetch (limite baixo)**

Run:
```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --spot-check-limit=4
```

Expected: 4 fetches reais com 2s de delay (~10-15s). Imprime verdicts (`ok`/`truncated`/`bloated`/`url-dead`). Script não deve crashar se alguma URL der timeout.

- [ ] **Step 8: Commit**

```bash
git add scripts/audit-legislative-acts.ts
git commit -m "feat(audit): seções 7-8 (amostras + spot-check com fetch)"
```

---

### Task 5: Geração dos relatórios markdown e JSON

**Files:**
- Modify: `scripts/audit-legislative-acts.ts`
- Create: `docs/audits/` (pasta)

- [ ] **Step 1: Garantir pasta docs/audits**

```bash
mkdir -p "C:/Projeto de site do Barral/sitedobarral-stripe/docs/audits"
```

- [ ] **Step 2: Função de agregação dos IDs problemáticos**

Adicionar junto às queries:

```typescript
async function buildProblemIdIndex(params: {
  hosts: HostRow[];
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
  const truncatedIds = truncated.filter((a) => (a.content?.length ?? 0) < 500).map((a) => a.id);

  // metadataIncomplete: falta qualquer um de (number, year, ementa, publishDate, officialUrl)
  const incomplete = await prisma.legislativeAct.findMany({
    where: {
      OR: [
        { number: '' },
        { ementa: '' },
        { officialUrl: null },
      ],
    },
    select: { id: true },
  });

  // unparsedHost: atos com officialUrl cujo host NÃO tem parser
  const allWithUrl = await prisma.legislativeAct.findMany({
    where: { officialUrl: { not: null } },
    select: { id: true, officialUrl: true },
  });
  const unparsedIds = allWithUrl.filter((a) => !hostHasParser(extractHost(a.officialUrl))).map((a) => a.id);

  return {
    contentMissing: missing.map((a) => a.id),
    contentTruncated: truncatedIds,
    metadataIncomplete: incomplete.map((a) => a.id),
    duplicateCandidates: params.duplicates.flatMap((g) => g.ids),
    unparsedHost: unparsedIds,
    spotCheckSuspicious: params.spotCheck.filter((r) => r.verdict === 'truncated' || r.verdict === 'bloated').map((r) => r.id),
  };
}
```

- [ ] **Step 3: Gerador de markdown**

```typescript
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
    for (const row of r.hostDistribution) lines.push(`| \`${row.host}\` | ${row.count} | ${row.hasParser ? '✓' : '✗ fallback'} |`);
    lines.push(``);
  }

  if (r.metadataCompleteness) {
    lines.push(`## 5. Completude de metadados por issuer`);
    lines.push(``);
    lines.push(`| Issuer | Campo | % preenchido | Filled/Total |`);
    lines.push(`|---|---|---:|---|`);
    for (const row of r.metadataCompleteness) lines.push(`| ${row.issuer} | ${row.field} | ${row.filledPct}% | ${row.filledCount}/${row.totalCount} |`);
    lines.push(``);
  }

  if (r.duplicates) {
    lines.push(`## 6. Duplicatas candidatas`);
    lines.push(``);
    if (r.duplicates.length === 0) lines.push(`Nenhuma.`);
    else {
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
  lines.push(`Lista completa de IDs em \`${path.basename(r.generatedAt)}.json\`.`);

  return lines.join('\n');
}
```

- [ ] **Step 4: Wire up dos writers em main()**

Substitua as seções de print por uma estrutura que colete os dados e, ao final, grave os arquivos. No final de `main()`:

```typescript
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
    problemIds: await buildProblemIdIndex({ hosts, duplicates, spotCheck }),
  };

  if (DRY_RUN) {
    console.log('\n[dry-run] Relatório NÃO será salvo.');
    return;
  }

  const outDir = path.join(process.cwd(), 'docs', 'audits');
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const mdPath = path.join(outDir, `${today}-legislative-acts-audit.md`);
  const jsonPath = path.join(outDir, `${today}-legislative-acts-audit.json`);

  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n✓ Relatório markdown: ${mdPath}`);
  console.log(`✓ Dump JSON: ${jsonPath}`);
```

- [ ] **Step 5: Testar dry-run**

Run:
```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --skip-fetch --dry-run
```

Expected: mesma saída de console, e no final "Relatório NÃO será salvo". Nenhum arquivo criado em `docs/audits/`.

- [ ] **Step 6: Testar write real (sem fetch)**

Run:
```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --skip-fetch
```

Expected: arquivos criados em `docs/audits/2026-04-19-legislative-acts-audit.md` e `.json`. Abrir o `.md` e verificar: tabelas renderizam corretamente, seções 1-7 presentes, seção 8 ausente (skip-fetch), problem IDs somadas batem.

- [ ] **Step 7: Commit do script completo**

```bash
git add scripts/audit-legislative-acts.ts
git commit -m "feat(audit): write markdown+json reports to docs/audits/"
```

---

### Task 6: Execução final contra produção e commit do relatório

**Files:**
- Run: `scripts/audit-legislative-acts.ts`
- Commit: `docs/audits/2026-04-19-legislative-acts-audit.md` + `.json`

- [ ] **Step 1: Rodar auditoria completa contra Neon**

Run:
```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts
```

Expected: rodada completa (spot-check de 12 URLs com 2s delay = ~30s). Arquivos gerados em `docs/audits/`.

Se um ou mais fetches derem timeout/erro, OK — o script registra `url-dead` no relatório e continua.

- [ ] **Step 2: Revisar o relatório com o usuário**

Abrir `docs/audits/2026-04-19-legislative-acts-audit.md` e ler com atenção:
- Seção 4 confirma quais hosts TCU não têm parser? (esperado: sim)
- Seção 2 mostra muitos atos com `content.length < 500`?
- Seção 8 (ratios) confirma truncamento real?
- Seção 6 aponta duplicatas inesperadas?

Não prosseguir com fixes sem revisão humana desses achados.

- [ ] **Step 3: Commit dos relatórios**

```bash
git add docs/audits/2026-04-19-legislative-acts-audit.md docs/audits/2026-04-19-legislative-acts-audit.json
git commit -m "docs(audit): relatório de auditoria de LegislativeActs — 2026-04-19"
```

- [ ] **Step 4: Atualizar FUTURE_TASKS.md refletindo achados**

Abrir `FUTURE_TASKS.md`. Refinar T1 com base no relatório real:
- Corrigir nomenclatura MPF → MPU (ou adicionar MPF se houver)
- Listar hosts que precisam de parser novo
- Referenciar o relatório: `Ver docs/audits/2026-04-19-legislative-acts-audit.md`

Commit:
```bash
git add FUTURE_TASKS.md
git commit -m "docs: refinar T1 com achados da auditoria 2026-04-19"
```

---

## Self-Review

**Spec coverage:**
- ✓ Seção 1 (inventário) → Task 2 step 2
- ✓ Seção 2 (content length) → Task 2 step 3
- ✓ Seção 3 (scrapeStatus) → Task 2 step 4
- ✓ Seção 4 (hosts) → Task 3 step 2
- ✓ Seção 5 (metadata) → Task 3 step 3
- ✓ Seção 6 (duplicatas) → Task 3 step 4
- ✓ Seção 7 (amostras) → Task 4 step 2
- ✓ Seção 8 (spot-check) → Task 4 steps 3-4
- ✓ CLI args (`--spot-check-limit`, `--skip-fetch`, `--dry-run`) → Task 1 step 1
- ✓ Output MD + JSON → Task 5 steps 3-4
- ✓ Problem ID index → Task 5 step 2
- ✓ Não objetivos (read-only, sem mutações) → respeitado em todas as queries

**Placeholder scan:** nenhum TBD/TODO; todo código em blocos é completo.

**Type consistency:** `AuditReport` campos nomeados consistentemente com queries; `SpotCheckRow.verdict` mesmo tipo em runSpotCheck e renderMarkdown.

**Ambiguidade:** nenhuma identificada.

---

## Próximo passo

Após o plano aprovado, offer execução:
1. Subagent-driven (recomendado)
2. Inline (executing-plans)
