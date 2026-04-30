/**
 * scrape-incp-enunciados.ts
 *
 * Faz fetch do site oficial INCP (incpbrasil.com.br/enunciados-aprovados/)
 * e extrai os enunciados aprovados.
 *
 * Output: docs/audits/2026-04-30-incp-enunciados-scraped.json
 */

import * as fs from 'fs';
import * as path from 'path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

interface IncpEnunciado {
  numero: number;
  reuniao: 1 | 2;
  texto: string;
  fonte: string;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

const URLS = [
  'https://incpbrasil.com.br/enunciados-aprovados/',
  'https://incpbrasil.com.br/informativo-enunciados-2a-edicao/',
];

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return await r.text();
}

function extractEnunciados(html: string, sourceUrl: string): IncpEnunciado[] {
  const enunciados: IncpEnunciado[] = [];

  // Procura "Enunciado N" como marcador (em <strong> ou <h>) seguido de texto
  // até o próximo "Enunciado M" ou marcador de fim
  const patternA =
    /(?:<(?:strong|b|h[1-6])[^>]*>\s*)?Enunciado\s+(?:n[º°]?\s*)?(\d{1,3})\s*(?:<\/(?:strong|b|h[1-6])>)?\s*[.\s:\-]*\s*([\s\S]+?)(?=(?:<(?:strong|b|h[1-6])[^>]*>\s*)?Enunciado\s+(?:n[º°]?\s*)?\d{1,3}|<\/article|<\/main|<\/section|<footer|$)/gi;
  let m: RegExpExecArray | null;
  patternA.lastIndex = 0;
  while ((m = patternA.exec(html)) !== null) {
    const numero = parseInt(m[1], 10);
    if (numero < 1 || numero > 100) continue;
    let txt = m[2].replace(/<[^>]+>/g, ' ');
    txt = decodeHtml(txt).replace(/\s+/g, ' ').trim();
    if (txt.length < 30 || txt.length > 5000) continue;
    if (enunciados.some((e) => e.numero === numero)) continue;

    // Reunião baseada no número: 1-22 = 1ª; 23+ = 2ª (ou 3ª)
    const reuniao: 1 | 2 = numero <= 22 ? 1 : 2;

    enunciados.push({ numero, reuniao, texto: txt, fonte: sourceUrl });
  }
  return enunciados;
}

async function main() {
  let allEnun: IncpEnunciado[] = [];

  for (const url of URLS) {
    console.log(`Fetch ${url}`);
    try {
      const html = await fetchHtml(url);
      console.log(`  HTML ${(html.length / 1024).toFixed(1)} KB`);
      const ext = extractEnunciados(html, url);
      console.log(`  → ${ext.length} enunciados extraídos`);
      // Merge: preferir entrada nova se ainda não temos
      for (const e of ext) {
        if (!allEnun.some((a) => a.numero === e.numero && a.reuniao === e.reuniao)) {
          allEnun.push(e);
        }
      }
    } catch (e) {
      console.error(`  ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nTotal único: ${allEnun.length}`);
  console.log('\nDistribuição:');
  const r1 = allEnun.filter((e) => e.reuniao === 1).length;
  const r2 = allEnun.filter((e) => e.reuniao === 2).length;
  console.log(`  1ª Reunião Técnica: ${r1}`);
  console.log(`  2ª Reunião Técnica: ${r2}`);

  console.log('\nPrimeiros 3:');
  for (const e of allEnun.slice(0, 3)) {
    console.log(`  Enunciado ${e.numero} (R${e.reuniao}): ${e.texto.slice(0, 150)}...`);
  }

  allEnun.sort((a, b) => (a.reuniao - b.reuniao) || (a.numero - b.numero));

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-incp-enunciados-scraped.json`
  );
  fs.writeFileSync(
    outPath,
    JSON.stringify({ scrapedAt: new Date().toISOString(), total: allEnun.length, enunciados: allEnun }, null, 2)
  );
  console.log(`\n✅ JSON salvo: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
