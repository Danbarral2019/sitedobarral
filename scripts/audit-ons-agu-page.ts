import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';

// ETAPA 1 (DRY-RUN, não grava nada): raspa a página oficial de ONs da AGU,
// extrai cada ON (número, ano, enunciado integral, link DOU, histórico) e
// mostra o diff contra o banco. Produz o relatório que embasa a decisão de
// backfill + cron.
//
// Estrutura da página (verificada 2026-07-14):
//   div.on-card > div.on-titulo > a[href=DOU]  "Orientação Normativa N/AAAA"
//                 div.on-corpo   -> enunciado integral (texto normativo)
//                 div.on-meta    -> histórico/observações
// A página é servida em latin-1 (apesar do meta dizer utf-8).

const URL = 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';

type PageON = { onNumber: number; onYear: number; enunciado: string; douUrl: string | null; meta: string };

function norm(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

async function fetchPage(): Promise<string> {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('latin1'); // página vem em latin-1
}

function parse(html: string): PageON[] {
  const $ = cheerio.load(html);
  const out: PageON[] = [];
  $('.on-card').each((_, el) => {
    const card = $(el);
    const titA = card.find('.on-titulo a').first();
    const titText = card.find('.on-titulo').text();
    const m = titText.match(/Normativa\s+n?[º°.]?\s*(\d+)\s*\/\s*(\d{4})/i);
    if (!m) return;
    const href = titA.attr('href') || null;
    out.push({
      onNumber: parseInt(m[1], 10),
      onYear: parseInt(m[2], 10),
      enunciado: card.find('.on-corpo').text().replace(/\s+/g, ' ').trim(),
      douUrl: href && /in\.gov\.br/i.test(href) ? href : href, // guarda o link seja qual for; marca se é DOU abaixo
      meta: card.find('.on-meta').text().replace(/\s+/g, ' ').trim(),
    });
  });
  return out;
}

async function main() {
  console.log('Buscando página AGU...');
  const html = await fetchPage();
  const page = parse(html);
  const pageKey = new Map(page.map((o) => [`${o.onNumber}/${o.onYear}`, o]));
  console.log(`Cards de ON na página: ${page.length}  (distintos: ${pageKey.size})`);
  const douCount = page.filter((o) => o.douUrl && /in\.gov\.br/i.test(o.douUrl)).length;
  console.log(`  com link in.gov.br (DOU) no título: ${douCount}/${page.length}`);

  // Banco: dedupe por onNumber/onYear, guardando melhor content/description/douUrl
  const docs = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    select: { onNumber: true, onYear: true, isPublic: true, description: true, content: true, douUrl: true },
  });
  const db = new Map<string, { pub: boolean; descLen: number; contentLen: number; hasDou: boolean; enun: string }>();
  for (const d of docs) {
    const key = `${d.onNumber ?? '?'}/${d.onYear ?? '?'}`;
    const cur = db.get(key);
    const descLen = (d.description ?? '').trim().length;
    const contentLen = (d.content ?? '').trim().length;
    const enun = (d.content && d.content.trim().length > 50 ? d.content : d.description ?? '').trim();
    if (!cur) db.set(key, { pub: !!d.isPublic, descLen, contentLen, hasDou: !!(d.douUrl && d.douUrl.trim()), enun });
    else {
      cur.pub = cur.pub || !!d.isPublic;
      cur.descLen = Math.max(cur.descLen, descLen);
      cur.contentLen = Math.max(cur.contentLen, contentLen);
      cur.hasDou = cur.hasDou || !!(d.douUrl && d.douUrl.trim());
      if (enun.length > cur.enun.length) cur.enun = enun;
    }
  }
  console.log(`ONs distintas no banco: ${db.size}\n`);

  // Buckets
  const novasNaPagina: string[] = [];     // na página, ausentes no banco
  const soNoBanco: string[] = [];         // no banco, ausentes na página
  const backfillContent: string[] = [];   // página tem corpo; banco content vazio
  const backfillDou: string[] = [];       // página tem link DOU; banco douUrl vazio
  const redacaoDivergente: { key: string; sim: number }[] = []; // ambos têm texto, mas divergem

  for (const [key, p] of pageKey) {
    const d = db.get(key);
    if (!d) { novasNaPagina.push(key); continue; }
    if (p.enunciado.length > 50 && d.contentLen < 50) backfillContent.push(key);
    if (p.douUrl && /in\.gov\.br/i.test(p.douUrl) && !d.hasDou) backfillDou.push(key);
    // divergência de redação só quando o banco tem texto substantivo próprio
    if (d.enun.length > 80 && p.enunciado.length > 80) {
      const a = norm(d.enun), b = norm(p.enunciado);
      // similaridade grosseira por prefixo comum de palavras
      const wa = a.split(' '), wb = b.split(' ');
      let common = 0; const setB = new Set(wb);
      for (const w of wa) if (setB.has(w)) common++;
      const sim = common / Math.max(wa.length, wb.length);
      if (sim < 0.7) redacaoDivergente.push({ key, sim: Math.round(sim * 100) });
    }
  }
  for (const key of db.keys()) if (!pageKey.has(key)) soNoBanco.push(key);

  const byNum = (a: string, b: string) => {
    const [na, ya] = a.split('/').map(Number); const [nb, yb] = b.split('/').map(Number);
    return ya - yb || na - nb;
  };

  console.log(`── (A) ONs NA PÁGINA, ausentes no banco (candidatas a importar): ${novasNaPagina.length}`);
  novasNaPagina.sort(byNum).forEach((k) => console.log(`   ON ${k}`));

  console.log(`\n── (B) ONs SÓ no banco, ausentes na página: ${soNoBanco.length}`);
  soNoBanco.sort(byNum).forEach((k) => console.log(`   ON ${k}  (${db.get(k)!.pub ? 'pública' : 'não-pública'})`));

  console.log(`\n── (C) Backfill de TEXTO INTEGRAL (página tem corpo; banco content vazio): ${backfillContent.length}`);
  console.log('   ' + backfillContent.sort(byNum).join('  '));

  console.log(`\n── (D) Backfill de LINK DOU (página tem in.gov.br; banco douUrl vazio): ${backfillDou.length}`);
  console.log('   ' + backfillDou.sort(byNum).join('  '));

  console.log(`\n── (E) REDAÇÃO possivelmente DIVERGENTE (banco vs página, similaridade < 70%): ${redacaoDivergente.length}`);
  redacaoDivergente.sort((x, y) => byNum(x.key, y.key)).forEach((r) => console.log(`   ON ${r.key}  sim≈${r.sim}%`));

  console.log('\n── Amostra: ON 107/2026 como a página entrega ──');
  const s = pageKey.get('107/2026');
  if (s) {
    console.log(`   douUrl: ${s.douUrl}`);
    console.log(`   enunciado (${s.enunciado.length} chars): ${s.enunciado.slice(0, 200)}...`);
    console.log(`   meta: ${s.meta.slice(0, 120)}`);
  }

  console.log('\n(DRY-RUN — nada foi gravado.)');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
