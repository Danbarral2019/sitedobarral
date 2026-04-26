/**
 * Importação automatizada de atos órfãos detectados pelo
 * `list-orphan-relations.ts`.
 *
 * Lê o JSON mais recente em `docs/audits/orphan-relations-*.json`, parseia o
 * `targetFullNumber` de cada órfão em (type, number, year), e tenta:
 *   1. Inferir URL no Planalto via cascata de patterns por ano (Lei,
 *      Lei Complementar, Decreto). Outros tipos (IN, Portaria,
 *      Resolução, MP) ainda não têm pattern automático — vão pra fila
 *      manual no relatório.
 *   2. Fazer GET HEAD/GET até encontrar uma URL válida (200 OK).
 *   3. Scrape via `scrapeUrl` (já aplica normalização legacy).
 *   4. Extrair ementa heurística do primeiro parágrafo significativo.
 *   5. Inferir publishDate do título ou fallback `1º jan do ano`.
 *   6. Criar `LegislativeAct` (skip se fullNumber já existe — upsert).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-orphans-auto.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/import-orphans-auto.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/import-orphans-auto.ts --types lei,decreto --limit 5
 *
 *   --dry-run            Não persiste, só reporta plano.
 *   --types lei,decreto  Filtra por tipo (default: lei,lc,decreto).
 *   --limit N            Limita quantos atos processar.
 *   --audit PATH         Usa um JSON específico (default: mais recente).
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// =====================================================================
// Args
// =====================================================================

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? '0', 10) : 0;
const typesIdx = args.indexOf('--types');
const TYPES_FILTER = typesIdx >= 0 ? (args[typesIdx + 1] ?? '').split(',').map((s) => s.trim().toLowerCase()) : ['lei', 'lc', 'decreto'];
const auditIdx = args.indexOf('--audit');
const AUDIT_OVERRIDE = auditIdx >= 0 ? args[auditIdx + 1] : null;

// =====================================================================
// Audit loader
// =====================================================================

interface OrphanEntry {
  target: string;
  count: number;
  citedBy: string[];
  relationTypes: string[];
}

interface OrphanAudit {
  generatedAt: string;
  totalActs: number;
  totalOrphanTargets: number;
  orphans: OrphanEntry[];
}

function findLatestAuditPath(): string {
  if (AUDIT_OVERRIDE) return resolve(AUDIT_OVERRIDE);
  const dir = resolve('docs/audits');
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('orphan-relations-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) {
    throw new Error('Nenhum orphan-relations-*.json em docs/audits/. Rode list-orphan-relations.ts antes.');
  }
  return resolve(dir, files[0]);
}

// =====================================================================
// Parse fullNumber → {type, number, year, issuer?}
// =====================================================================

interface ParsedTarget {
  type: 'lei' | 'lc' | 'decreto' | 'in' | 'portaria' | 'resolucao' | 'mp' | 'on' | 'unknown';
  number: string;
  year: number | null;
  issuer: string | null;
  raw: string;
}

const NUM_YEAR_RE = /(\d[\d.]*?)\s*\/\s*(\d{2,4})\s*$/;

function parseTarget(raw: string): ParsedTarget {
  const norm = raw.trim();
  const m = norm.match(NUM_YEAR_RE);
  if (!m) {
    return { type: 'unknown', number: '', year: null, issuer: null, raw };
  }
  const number = m[1];
  let year = parseInt(m[2], 10);
  if (year < 100) {
    year = year >= 50 ? 1900 + year : 2000 + year;
  }
  // Tipo: prefixo antes do número (depois de strip de issuer)
  const lower = norm.toLowerCase();
  if (/\blei\s+complementar\b|\blc\b/.test(lower)) {
    return { type: 'lc', number, year, issuer: 'Presidência da República', raw };
  }
  if (/\blei\b/.test(lower)) {
    return { type: 'lei', number, year, issuer: 'Presidência da República', raw };
  }
  if (/\bdecreto\b/.test(lower)) {
    return { type: 'decreto', number, year, issuer: 'Presidência da República', raw };
  }
  if (/\bin\b/.test(lower)) {
    const issuerMatch = norm.match(/IN\s+([A-Z][\w\/-]+)/);
    return { type: 'in', number, year, issuer: issuerMatch?.[1] ?? null, raw };
  }
  if (/\bportaria\b/.test(lower)) {
    const issuerMatch = norm.match(/Portaria\s+([A-Z][\w\/-]+)/);
    return { type: 'portaria', number, year, issuer: issuerMatch?.[1] ?? null, raw };
  }
  if (/\bresolu/.test(lower)) {
    return { type: 'resolucao', number, year, issuer: null, raw };
  }
  if (/\bmedida\s+provis|\bmp\b/.test(lower)) {
    return { type: 'mp', number, year, issuer: 'Presidência da República', raw };
  }
  if (/\bordem\s+de\s+servi|\bon\b/.test(lower)) {
    return { type: 'on', number, year, issuer: null, raw };
  }
  return { type: 'unknown', number, year, issuer: null, raw };
}

// =====================================================================
// URL candidates (Planalto)
// =====================================================================

function planaltoLeiUrls(num: string, year: number): string[] {
  const N = num.replace(/\./g, '');
  // Períodos canônicos do Planalto
  const periodos: [number, number, string][] = [
    [2023, 2026, '_Ato2023-2026'],
    [2019, 2022, '_Ato2019-2022'],
    [2015, 2018, '_Ato2015-2018'],
    [2011, 2014, '_Ato2011-2014'],
    [2007, 2010, '_Ato2007-2010'],
    [2004, 2006, '_Ato2004-2006'],
  ];
  const urls: string[] = [];
  for (const [from, to, slug] of periodos) {
    if (year >= from && year <= to) {
      urls.push(`https://www.planalto.gov.br/ccivil_03/${slug}/${year}/Lei/L${N}.htm`);
    }
  }
  // Pre-2004: padrão simples
  urls.push(`https://www.planalto.gov.br/ccivil_03/leis/L${N}.htm`);
  urls.push(`https://www.planalto.gov.br/ccivil_03/leis/L${N}compilado.htm`);
  return urls;
}

function planaltoLcUrls(num: string): string[] {
  const N = num.replace(/\./g, '');
  return [
    `https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp${N}.htm`,
    `https://www.planalto.gov.br/ccivil_03/leis/LCP/Lcp${N}.htm`,
  ];
}

function planaltoDecretoUrls(num: string, year: number): string[] {
  const N = num.replace(/\./g, '');
  const periodos: [number, number, string][] = [
    [2023, 2026, '_Ato2023-2026'],
    [2019, 2022, '_Ato2019-2022'],
    [2015, 2018, '_Ato2015-2018'],
    [2011, 2014, '_Ato2011-2014'],
    [2007, 2010, '_Ato2007-2010'],
    [2004, 2006, '_Ato2004-2006'],
  ];
  const urls: string[] = [];
  for (const [from, to, slug] of periodos) {
    if (year >= from && year <= to) {
      urls.push(`https://www.planalto.gov.br/ccivil_03/${slug}/${year}/Decreto/D${N}.htm`);
    }
  }
  urls.push(`https://www.planalto.gov.br/ccivil_03/decreto/${year}/D${N}.htm`);
  urls.push(`https://www.planalto.gov.br/ccivil_03/decreto/D${N}.htm`);
  return urls;
}

function buildUrlCandidates(parsed: ParsedTarget): string[] {
  if (parsed.year === null) return [];
  switch (parsed.type) {
    case 'lei':
      // Quando "Lei N/Y" não acha, tenta também como Lei Complementar — o
      // detector heurístico não diferencia LC de Lei sem o prefixo explícito,
      // então 'Lei 95/1998' (LC 95/1998 — redação de leis) e 'Lei 123/2006'
      // (LC 123/2006 — Microempresas) caem aqui como Lei.
      return [
        ...planaltoLeiUrls(parsed.number, parsed.year),
        ...planaltoLcUrls(parsed.number),
      ];
    case 'lc':
      return planaltoLcUrls(parsed.number);
    case 'decreto':
      return planaltoDecretoUrls(parsed.number, parsed.year);
    default:
      return [];
  }
}

async function urlExists(url: string): Promise<boolean> {
  // Planalto rejeita HEAD (405 Method Not Allowed). Usamos GET mas
  // cancelamos o body assim que recebemos os headers — só queremos saber
  // se a URL existe (status 200).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; sitedobarral-orphan-import/1.0; +https://www.profdanielbarral.com)',
      },
    });
    // Cancela o body — não precisamos do conteúdo aqui (scrapeUrl faz isso depois)
    if (res.body) {
      try { await res.body.cancel(); } catch { /* ignore */ }
    }
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function findFirstWorking(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    if (await urlExists(url)) return url;
  }
  return null;
}

// =====================================================================
// Extração heurística
// =====================================================================

const MONTHS_PT: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function extractPublishDate(content: string, fallbackYear: number): Date {
  const m = content.match(/\bde\s+(\d{1,2})\s+de\s+([a-zA-Zçãé]+)\s+de\s+(\d{4})/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthName = m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const year = parseInt(m[3], 10);
    const month = MONTHS_PT[monthName];
    if (month !== undefined && year >= 1800 && year <= 2100) {
      return new Date(Date.UTC(year, month, day));
    }
  }
  return new Date(Date.UTC(fallbackYear, 0, 1));
}

function extractEmenta(content: string): string {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  // Pula até encontrar uma linha que pareça ementa: começa com maiúscula,
  // tem pelo menos 80 chars, não é o título do ato, não é "Faço saber...".
  for (const line of lines) {
    if (line.length < 80) continue;
    if (/^(LEI|DECRETO|LEI\s+COMPLEMENTAR|MEDIDA\s+PROVIS)/i.test(line)) continue;
    if (/^Faço\s+saber/i.test(line)) continue;
    if (/^O\s+PRESIDENTE/i.test(line)) continue;
    return line.slice(0, 1500);
  }
  return lines[0]?.slice(0, 1500) ?? '';
}

function extractTitle(content: string, parsed: ParsedTarget): string {
  const m = content.match(/^(LEI(?:\s+COMPLEMENTAR)?|DECRETO|MEDIDA\s+PROVIS[ÓO]RIA)[\s\S]{0,300}?\n/im);
  if (m) {
    return m[0].replace(/\s+/g, ' ').trim().slice(0, 500);
  }
  return parsed.raw;
}

// =====================================================================
// Hierarchy mapping
// =====================================================================

const HIERARCHY: Record<ParsedTarget['type'], number> = {
  lc: 1,
  lei: 2,
  mp: 2,
  decreto: 4,
  resolucao: 4,
  in: 5,
  portaria: 5,
  on: 5,
  unknown: 5,
};

function buildFullNumber(parsed: ParsedTarget): string {
  const map: Record<ParsedTarget['type'], string> = {
    lc: 'Lei Complementar',
    lei: 'Lei',
    mp: 'MP',
    decreto: 'Decreto',
    resolucao: 'Resolução',
    in: 'IN',
    portaria: 'Portaria',
    on: 'ON',
    unknown: '',
  };
  const prefix = map[parsed.type];
  const num = parsed.number;
  return `${prefix} ${num}/${parsed.year}`.trim();
}

// =====================================================================
// Main
// =====================================================================

interface Outcome {
  target: string;
  type: ParsedTarget['type'];
  status: 'created' | 'already-exists' | 'no-url' | 'unsupported-type' | 'scrape-failed' | 'dry-run';
  url?: string;
  fullNumber?: string;
  contentChars?: number;
  reason?: string;
}

async function main() {
  const auditPath = findLatestAuditPath();
  console.log(`Lendo audit: ${basename(auditPath)}`);
  const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as OrphanAudit;
  console.log(`Total órfãos no audit: ${audit.orphans.length}\n`);

  let toProcess = audit.orphans;
  if (LIMIT > 0) toProcess = toProcess.slice(0, LIMIT);

  const outcomes: Outcome[] = [];

  for (const orphan of toProcess) {
    const parsed = parseTarget(orphan.target);
    if (!TYPES_FILTER.includes(parsed.type)) {
      outcomes.push({
        target: orphan.target,
        type: parsed.type,
        status: 'unsupported-type',
        reason: `tipo "${parsed.type}" não habilitado em --types=${TYPES_FILTER.join(',')}`,
      });
      continue;
    }

    if (parsed.year === null) {
      outcomes.push({ target: orphan.target, type: parsed.type, status: 'no-url', reason: 'fullNumber sem ano' });
      continue;
    }

    process.stdout.write(`[${parsed.type}] ${orphan.target} ... `);
    const candidates = buildUrlCandidates(parsed);
    const url = await findFirstWorking(candidates);
    if (!url) {
      console.log('❌ no URL');
      outcomes.push({
        target: orphan.target,
        type: parsed.type,
        status: 'no-url',
        reason: `${candidates.length} candidatas testadas, nenhuma 200 OK`,
      });
      continue;
    }

    const scrape = await scrapeUrl(url);
    if (!scrape.success || !scrape.content) {
      console.log(`❌ scrape failed: ${scrape.error ?? 'sem content'}`);
      outcomes.push({
        target: orphan.target,
        type: parsed.type,
        status: 'scrape-failed',
        url,
        reason: scrape.error ?? 'sem content',
      });
      continue;
    }
    // Sanity: páginas antigas em FrontPage HTML às vezes não casam com os
    // seletores do Planalto e cai pro fallback `<body>` que retorna ~150 chars
    // (só o title). Marca como manual.
    if (scrape.content.length < 500) {
      console.log(`❌ scrape too short: ${scrape.content.length} chars (provavelmente HTML antigo)`);
      outcomes.push({
        target: orphan.target,
        type: parsed.type,
        status: 'scrape-failed',
        url,
        reason: `content muito curto (${scrape.content.length} chars) — scraper não casou seletores`,
      });
      continue;
    }

    // Se a URL Planalto foi do diretório de Leis Complementares, reclassifica
    // como 'lc' (corrigindo falsos "Lei N/Y" que na verdade eram LC).
    if (/lcp\/Lcp/i.test(url) && parsed.type === 'lei') {
      parsed.type = 'lc';
    }

    const content = normalizeScrapedText(scrape.content);
    const fullNumber = buildFullNumber(parsed);
    const ementa = extractEmenta(content);
    const title = extractTitle(content, parsed);
    const publishDate = extractPublishDate(content, parsed.year);

    const existing = await prisma.legislativeAct.findUnique({
      where: { fullNumber },
      select: { id: true },
    });
    if (existing) {
      console.log(`⚠ already exists`);
      outcomes.push({ target: orphan.target, type: parsed.type, status: 'already-exists', fullNumber });
      continue;
    }

    if (DRY_RUN) {
      console.log(`✓ DRY: ${fullNumber} (${content.length} chars)`);
      outcomes.push({
        target: orphan.target,
        type: parsed.type,
        status: 'dry-run',
        url,
        fullNumber,
        contentChars: content.length,
      });
      continue;
    }

    await prisma.legislativeAct.create({
      data: {
        fullNumber,
        type: parsed.type === 'lc' ? 'lei-complementar' : parsed.type,
        number: parsed.number,
        year: parsed.year,
        title,
        ementa,
        issuer: parsed.issuer ?? 'Presidência da República',
        publishDate,
        hierarchyLevel: HIERARCHY[parsed.type],
        officialUrl: url,
        content,
        esfera: 'federal',
        embeddingStatus: 'pending',
        createdBy: 'import-orphans-auto',
      },
    });
    console.log(`✓ CREATED ${fullNumber} (${content.length} chars)`);
    outcomes.push({
      target: orphan.target,
      type: parsed.type,
      status: 'created',
      url,
      fullNumber,
      contentChars: content.length,
    });
  }

  // Resumo
  const grouped = new Map<Outcome['status'], number>();
  for (const o of outcomes) grouped.set(o.status, (grouped.get(o.status) ?? 0) + 1);
  console.log('\n=== Resumo ===');
  for (const [k, v] of grouped) console.log(`${k}: ${v}`);

  console.log('\n--- Manuais (precisam URL/dados manuais) ---');
  for (const o of outcomes) {
    if (o.status === 'unsupported-type' || o.status === 'no-url' || o.status === 'scrape-failed') {
      console.log(`  - ${o.target}: ${o.status}${o.reason ? ' - ' + o.reason : ''}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
