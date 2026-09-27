/**
 * find-ons-dou-urls.ts
 *
 * T2b / Leva 2 (resto): encontra e valida o link DOU específico das ONs AGU
 * públicas que ainda não o têm, e (com --apply) grava no banco.
 *
 * RODAR NA MÁQUINA LOCAL — precisa de acesso a www.in.gov.br e web.archive.org
 * e do .env.local com DATABASE_URL. O ambiente de nuvem bloqueia esses hosts.
 *
 * Descoberta de candidatos (em ordem):
 *   1. Busca do DOU (in.gov.br/consulta) via Playwright: carrega a página de
 *      resultados; se vier vazia, faz o fluxo de UI (digitar + Enter + esperar).
 *      Coleta links /web/dou/-/<slug> da DOM e do JSON embutido no portlet.
 *   2. Wayback Machine (CDX) por prefixo do slug
 *      in.gov.br/web/dou/-/orientacao-normativa[-agu]-n-<N>-de — serve só para
 *      DESCOBRIR o slug; a URL gravada é sempre a do in.gov.br, validada ao vivo.
 *   3. --manual <arquivo.json> com [{ onNumber, onYear, url }] (ex.: páginas
 *      pesquisa.in.gov.br/imprensa/jsp/visualiza das ONs 2009-2014 achadas à mão).
 *
 * Validação (skill inclusao-documentos — nunca gravar URL não validada):
 *   - HTTP 200 ao vivo, sem redirecionar para login/erro;
 *   - página do ato (in.gov.br/web/dou): o título `.identifica` tem que ser
 *     "ORIENTAÇÃO NORMATIVA [AGU] Nº <N>, DE <dia> DE <mês> DE <ano>" com N e
 *     ano iguais a onNumber/onYear, e o texto tem que citar a AGU;
 *   - URL manual (PDF/visualiza, várias matérias na página): exige menção
 *     "Orientação Normativa ... nº <N> ... <ano>", menção à AGU e sobreposição
 *     de vocabulário ≥ 0,6 com o enunciado do banco.
 *   A sobreposição com o enunciado do banco sai sempre no relatório; abaixo de
 *   0,3 numa página de ato a ON vai para "alerta" e NÃO é gravada.
 *
 * Uso:
 *   npx tsx scripts/find-ons-dou-urls.ts                 # dry-run: relatório
 *   npx tsx scripts/find-ons-dou-urls.ts --only 33/2011  # uma ON só
 *   npx tsx scripts/find-ons-dou-urls.ts --manual docs/audits/ons-manual.json
 *   npx tsx scripts/find-ons-dou-urls.ts --apply [--input <relatorio.json>]
 *   Flags: --headed (mostra o navegador), --no-wayback, --no-search
 *
 * Saída: docs/audits/<data>-ons-dou-urls-t2b.{json,md}
 * --apply relê o JSON do dry-run, revalida cada URL ao vivo e só então grava
 * (url ← DOU; url antiga → alternativeUrls). Log em <data>-ons-dou-urls-t2b-apply-log.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';
import { prisma } from '../lib/prisma';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const THROTTLE_MS = 1500;
const MESES = 'janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';

/** Link DOU específico já gravado: página do ato no in.gov.br ou página do jornal (visualiza). */
const SPECIFIC_DOU = /in\.gov\.br\/(?:en\/)?web\/dou\/-\/|pesquisa\.in\.gov\.br\/imprensa\/jsp\/visualiza/i;

type Status = 'validada' | 'alerta' | 'pendente';

interface OnRow {
  id: string;
  onNumber: number;
  onYear: number;
  url: string;
  alternativeUrls: string | null;
  description: string | null;
}

interface Result {
  onNumber: number;
  onYear: number;
  dbId: string;
  urlAtual: string;
  status: Status;
  url?: string;
  fonte?: 'busca-dou' | 'wayback' | 'manual';
  evidencia?: { titulo: string; citaAgu: boolean; sobreposicao: number | null };
  candidatosTestados: string[];
  motivo?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(name);

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Proporção das palavras (≥4 letras) do enunciado do banco presentes no texto da página. */
function overlap(enunciado: string | null, pageText: string): number | null {
  if (!enunciado || enunciado.trim().length < 30) return null;
  const words = new Set(normalize(enunciado).match(/[a-z]{4,}/g) ?? []);
  if (words.size === 0) return null;
  const page = new Set(normalize(pageText).match(/[a-z]{4,}/g) ?? []);
  let hit = 0;
  for (const w of words) if (page.has(w)) hit++;
  return Math.round((hit / words.size) * 100) / 100;
}

/** Slug do ato no in.gov.br compatível com número/ano (pré-filtro; a prova é a validação). */
function slugMatches(url: string, n: number, year: number): boolean {
  const re = new RegExp(`/orientacao-normativa(?:-agu)?-n-0*${n}-de-\\d{1,2}-de-[a-z]+-de-${year}(?:-\\d+)?/?$`, 'i');
  return re.test(url.split(/[?#]/)[0]);
}

function canonicalDou(url: string): string {
  const m = url.match(/in\.gov\.br\/(?:en\/)?web\/dou\/-\/([^?#/]+)/i);
  return m ? `https://www.in.gov.br/web/dou/-/${m[1]}` : url;
}

// ---------------------------------------------------------------- descoberta

async function searchDou(page: Page, n: number, year: number): Promise<string[]> {
  const found = new Set<string>();
  const collect = async () => {
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
    for (const h of hrefs) if (/in\.gov\.br\/(?:en\/)?web\/dou\/-\//i.test(h)) found.add(canonicalDou(h));
    // Resultados também vêm num JSON embutido pelo portlet de busca.
    const scripts = await page.$$eval('script[type="application/json"]', (ss) => ss.map((s) => s.textContent ?? ''));
    for (const s of scripts) {
      for (const m of s.matchAll(/"urlTitle"\s*:\s*"([^"]+)"/g)) found.add(`https://www.in.gov.br/web/dou/-/${m[1]}`);
    }
  };

  const queries = [`"orientação normativa nº ${n}" ${year}`, `orientação normativa ${n} ${year} advocacia-geral da união`];
  for (const q of queries) {
    const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(q)}&s=todos&exactDate=all&sortType=0`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await collect();

    if (![...found].some((u) => slugMatches(u, n, year))) {
      // Fluxo de UI: a busca não responde de forma confiável à query string.
      const input = page.locator('input[name="q"], input#search-bar, input[type="search"]').first();
      if (await input.count()) {
        await input.fill('');
        await input.type(q, { delay: 20 });
        await input.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await collect();
      }
    }
    if ([...found].some((u) => slugMatches(u, n, year))) break;
    await sleep(THROTTLE_MS);
  }
  return [...found].filter((u) => slugMatches(u, n, year));
}

async function searchWayback(n: number, year: number): Promise<string[]> {
  const out = new Set<string>();
  for (const prefix of [`orientacao-normativa-agu-n-${n}-de`, `orientacao-normativa-n-${n}-de`]) {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=www.in.gov.br/web/dou/-/${prefix}&matchType=prefix&output=json&fl=original&collapse=urlkey&limit=50`;
    try {
      const r = await fetch(cdx, { headers: { 'User-Agent': UA } });
      if (!r.ok) continue;
      const rows = (await r.json()) as string[][];
      for (const [original] of rows.slice(1)) {
        const u = canonicalDou(original.startsWith('http') ? original : `https://${original}`);
        if (slugMatches(u, n, year)) out.add(u);
      }
    } catch {
      // Wayback instável: segue sem ela.
    }
    await sleep(THROTTLE_MS);
  }
  return [...out];
}

// ----------------------------------------------------------------- validação

interface Validation {
  ok: boolean;
  motivo?: string;
  titulo: string;
  citaAgu: boolean;
  sobreposicao: number | null;
}

async function validate(page: Page, url: string, on: OnRow): Promise<Validation> {
  const empty = { titulo: '', citaAgu: false, sobreposicao: null };
  const isAtoPage = /in\.gov\.br\/web\/dou\/-\//i.test(url);

  let text = '';
  let titulo = '';
  if (isAtoPage) {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
    if (!resp) return { ok: false, motivo: 'timeout', ...empty };
    if (resp.status() !== 200) return { ok: false, motivo: `HTTP ${resp.status()}`, ...empty };
    if (canonicalDou(page.url()) !== canonicalDou(url)) return { ok: false, motivo: `redirecionou para ${page.url()}`, ...empty };
    titulo = ((await page.locator('.identifica').first().textContent().catch(() => null)) ?? '').trim();
    text = (await page.locator('.texto-dou, article, main').first().innerText().catch(() => '')) || (await page.innerText('body'));
  } else {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }).catch(() => null);
    if (!r) return { ok: false, motivo: 'timeout', ...empty };
    if (r.status !== 200) return { ok: false, motivo: `HTTP ${r.status}`, ...empty };
    if (/login|acesso-negado|erro/i.test(r.url)) return { ok: false, motivo: `redirecionou para ${r.url}`, ...empty };
    const ct = r.headers.get('content-type') ?? '';
    if (ct.includes('pdf')) {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: Buffer.from(await r.arrayBuffer()) });
      text = (await parser.getText()).text;
      await parser.destroy();
    } else {
      const html = await r.text();
      text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    }
  }

  const norm = normalize(text);
  const citaAgu = /advocacia-geral da uniao|advogado-geral da uniao/.test(norm);
  const sobreposicao = overlap(on.description, text);

  if (isAtoPage) {
    const t = normalize(titulo);
    const re = new RegExp(`^orientacao normativa(?: agu)?(?: n[ºo°.]*)?\\s*0*${on.onNumber}\\s*,\\s*de\\s+\\d{1,2}[ºo°]?\\s+de\\s+(?:${normalize(MESES)})\\s+de\\s+${on.onYear}\\b`);
    if (!titulo) return { ok: false, motivo: 'página sem título .identifica', titulo, citaAgu, sobreposicao };
    if (!re.test(t)) return { ok: false, motivo: `título não corresponde: "${titulo}"`, titulo, citaAgu, sobreposicao };
    if (!citaAgu) return { ok: false, motivo: 'texto não cita a AGU', titulo, citaAgu, sobreposicao };
    return { ok: true, titulo, citaAgu, sobreposicao };
  }

  const mencao = new RegExp(`orientacao normativa[^.]{0,40}n[ºo°.]*\\s*0*${on.onNumber}\\b[^.]{0,60}${on.onYear}`);
  titulo = (norm.match(mencao)?.[0] ?? '').slice(0, 160);
  if (!titulo) return { ok: false, motivo: 'página não menciona a ON com esse número e ano', titulo, citaAgu, sobreposicao };
  if (!citaAgu) return { ok: false, motivo: 'texto não cita a AGU', titulo, citaAgu, sobreposicao };
  if (sobreposicao === null || sobreposicao < 0.6)
    return { ok: false, motivo: `enunciado não confere (sobreposição ${sobreposicao ?? 'n/d'})`, titulo, citaAgu, sobreposicao };
  return { ok: true, titulo, citaAgu, sobreposicao };
}

// ------------------------------------------------------------------- dry-run

async function loadPendingOns(): Promise<OnRow[]> {
  const rows = await prisma.document.findMany({
    where: { category: 'orientacao-normativa', isPublic: true, onNumber: { not: null }, onYear: { not: null } },
    select: { id: true, onNumber: true, onYear: true, url: true, alternativeUrls: true, description: true },
    orderBy: [{ onYear: 'asc' }, { onNumber: 'asc' }],
  });
  return rows.filter((r) => !SPECIFIC_DOU.test(r.url ?? '')) as OnRow[];
}

async function dryRun(browser: Browser, outBase: string) {
  let ons = await loadPendingOns();
  const only = arg('--only');
  if (only) {
    const [n, y] = only.split('/').map(Number);
    ons = ons.filter((o) => o.onNumber === n && o.onYear === y);
  }
  const manualPath = arg('--manual');
  const manual: Array<{ onNumber: number; onYear: number; url: string }> = manualPath
    ? JSON.parse(fs.readFileSync(manualPath, 'utf-8'))
    : [];

  console.log(`ONs públicas sem link DOU específico: ${ons.length}\n`);
  const page = await browser.newPage({ userAgent: UA });
  const results: Result[] = [];

  for (const on of ons) {
    const label = `ON ${on.onNumber}/${on.onYear}`;
    const base: Result = { onNumber: on.onNumber, onYear: on.onYear, dbId: on.id, urlAtual: on.url, status: 'pendente', candidatosTestados: [] };

    const sources: Array<{ fonte: Result['fonte']; get: () => Promise<string[]> }> = [
      { fonte: 'manual', get: async () => manual.filter((m) => m.onNumber === on.onNumber && m.onYear === on.onYear).map((m) => m.url) },
      ...(flag('--no-search') ? [] : [{ fonte: 'busca-dou' as const, get: () => searchDou(page, on.onNumber, on.onYear) }]),
      ...(flag('--no-wayback') ? [] : [{ fonte: 'wayback' as const, get: () => searchWayback(on.onNumber, on.onYear) }]),
    ];

    const falhas: string[] = [];
    let achou = false;
    for (const src of sources) {
      let candidatos: string[] = [];
      try {
        candidatos = await src.get();
      } catch (e) {
        falhas.push(`${src.fonte}: erro na descoberta (${e instanceof Error ? e.message : e})`);
        continue;
      }
      for (const url of candidatos) {
        if (base.candidatosTestados.includes(url)) continue;
        base.candidatosTestados.push(url);
        const v = await validate(page, url, on);
        await sleep(THROTTLE_MS);
        if (!v.ok) {
          falhas.push(`${url} → ${v.motivo}`);
          continue;
        }
        const evidencia = { titulo: v.titulo, citaAgu: v.citaAgu, sobreposicao: v.sobreposicao };
        if (v.sobreposicao !== null && v.sobreposicao < 0.3) {
          results.push({ ...base, status: 'alerta', url, fonte: src.fonte, evidencia, motivo: `título confere, mas o enunciado do banco diverge (sobreposição ${v.sobreposicao})` });
        } else {
          results.push({ ...base, status: 'validada', url, fonte: src.fonte, evidencia });
        }
        achou = true;
        break;
      }
      if (achou) break;
    }

    if (!achou) {
      const motivo = base.candidatosTestados.length
        ? `candidatos reprovados na validação: ${falhas.join(' | ')}`
        : on.onYear < 2017
          ? 'nenhum candidato: ato anterior às páginas HTML do DOU (in.gov.br/web/dou); exige localizar a página do jornal (pesquisa.in.gov.br) e passar via --manual'
          : `nenhum candidato na busca do DOU nem na Wayback${falhas.length ? ` (${falhas.join(' | ')})` : ''}`;
      results.push({ ...base, motivo });
    }
    const last = results[results.length - 1];
    console.log(`${label.padEnd(14)} ${last.status.padEnd(9)} ${last.url ?? last.motivo}`);
  }

  await page.close();
  writeReport(outBase, results);
}

function writeReport(outBase: string, results: Result[]) {
  const count = (s: Status) => results.filter((r) => r.status === s).length;
  fs.writeFileSync(`${outBase}.json`, JSON.stringify({ geradoEm: new Date().toISOString(), results }, null, 2));

  const md: string[] = [
    `# ONs AGU sem link DOU específico: relatório de busca (${new Date().toISOString().slice(0, 10)})`,
    '',
    `Total analisado: ${results.length} · validadas: ${count('validada')} · alerta: ${count('alerta')} · pendentes: ${count('pendente')}`,
    '',
    '## Validadas (serão gravadas com --apply)',
    '',
    '| ON | URL DOU | Fonte | Título na página | Sobreposição c/ enunciado |',
    '|---|---|---|---|---|',
    ...results.filter((r) => r.status === 'validada').map((r) => `| ${r.onNumber}/${r.onYear} | ${r.url} | ${r.fonte} | ${r.evidencia?.titulo} | ${r.evidencia?.sobreposicao ?? 'n/d'} |`),
    '',
    '## Alerta (não serão gravadas; conferir à mão)',
    '',
    '| ON | URL | Motivo |',
    '|---|---|---|',
    ...results.filter((r) => r.status === 'alerta').map((r) => `| ${r.onNumber}/${r.onYear} | ${r.url} | ${r.motivo} |`),
    '',
    '## Pendentes',
    '',
    '| ON | Motivo |',
    '|---|---|',
    ...results.filter((r) => r.status === 'pendente').map((r) => `| ${r.onNumber}/${r.onYear} | ${(r.motivo ?? '').replace(/\|/g, '/')} |`),
    '',
  ];
  fs.writeFileSync(`${outBase}.md`, md.join('\n'));
  console.log(`\nValidadas: ${count('validada')} · alerta: ${count('alerta')} · pendentes: ${count('pendente')}`);
  console.log(`Relatório: ${outBase}.md / .json`);
}

// --------------------------------------------------------------------- apply

async function apply(browser: Browser, outBase: string) {
  const input = arg('--input') ?? `${outBase}.json`;
  if (!fs.existsSync(input)) throw new Error(`Relatório não encontrado: ${input}. Rode o dry-run antes.`);
  const { results } = JSON.parse(fs.readFileSync(input, 'utf-8')) as { results: Result[] };
  const toApply = results.filter((r) => r.status === 'validada' && r.url);
  console.log(`Validadas no relatório: ${toApply.length}. Revalidando ao vivo antes de gravar...\n`);

  const page = await browser.newPage({ userAgent: UA });
  const log: Array<{ on: string; url: string; resultado: string }> = [];

  for (const r of toApply) {
    const on = await prisma.document.findFirst({
      where: { category: 'orientacao-normativa', isPublic: true, onNumber: r.onNumber, onYear: r.onYear },
      select: { id: true, onNumber: true, onYear: true, url: true, alternativeUrls: true, description: true },
    });
    const label = `${r.onNumber}/${r.onYear}`;
    if (!on) {
      log.push({ on: label, url: r.url!, resultado: 'ON pública não encontrada no banco' });
      continue;
    }
    if (on.url === r.url) {
      log.push({ on: label, url: r.url!, resultado: 'já gravada' });
      continue;
    }
    const v = await validate(page, r.url!, on as OnRow);
    await sleep(THROTTLE_MS);
    if (!v.ok) {
      log.push({ on: label, url: r.url!, resultado: `revalidação falhou: ${v.motivo}` });
      continue;
    }

    let alt: string[] = [];
    try {
      const parsed = on.alternativeUrls ? JSON.parse(on.alternativeUrls) : [];
      alt = Array.isArray(parsed) ? parsed : [];
    } catch {
      alt = [];
    }
    if (on.url && !on.url.endsWith('/onsagu') && !alt.includes(on.url)) alt.push(on.url);

    await prisma.document.update({
      where: { id: on.id },
      data: { url: r.url!, type: 'link', alternativeUrls: alt.length ? JSON.stringify(alt) : on.alternativeUrls },
    });
    log.push({ on: label, url: r.url!, resultado: 'gravada' });
    console.log(`ON ${label} gravada → ${r.url}`);
  }

  await page.close();
  fs.writeFileSync(`${outBase}-apply-log.json`, JSON.stringify({ aplicadoEm: new Date().toISOString(), log }, null, 2));
  const gravadas = log.filter((l) => l.resultado === 'gravada').length;
  console.log(`\nGravadas: ${gravadas} de ${toApply.length}. Log: ${outBase}-apply-log.json`);
}

async function main() {
  const outBase = path.join(process.cwd(), 'docs', 'audits', `${new Date().toISOString().slice(0, 10)}-ons-dou-urls-t2b`);
  const browser = await chromium.launch({ headless: !flag('--headed') });
  try {
    if (flag('--apply')) await apply(browser, outBase);
    else await dryRun(browser, outBase);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
