/**
 * scrape-cjf-enunciados.ts
 *
 * Extrai os enunciados do CJF (1º e 2º Simpósios de Licitações e Contratos)
 * da página compilada por Irene Nohara em direitoadm.com.br, que reproduz
 * o texto oficial publicado pelo CJF.
 *
 * Total esperado: 54 enunciados (25 do 1º Simpósio 2022 + 29 do 2º Simpósio 2023).
 *
 * A numeração é contínua (1-54). 1-25 = 1º Simpósio (Lei 14.133 + 8.666),
 * 26-54 = 2º Simpósio (Lei 14.133).
 *
 * Output: docs/audits/2026-04-30-cjf-enunciados-scraped.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface CjfEnunciado {
  numero: number;
  simposio: 1 | 2;
  ano: number;
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
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

const SOURCE_URL = 'https://direitoadm.com.br/enunciados-licitacao-2-simposio/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

async function main() {
  console.log(`Fetch ${SOURCE_URL}...`);
  const r = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
    },
  });
  if (!r.ok) {
    console.error(`HTTP ${r.status}`);
    process.exit(1);
  }
  const html = await r.text();
  console.log(`HTML carregado (${(html.length / 1024).toFixed(0)} KB)`);

  // Padrão: <p ...>N. <texto até </p>>
  // Captura número + texto até fechamento da tag
  const pattern = /<p[^>]*>\s*(\d{1,2})\.\s*([\s\S]*?)<\/p>/gi;
  const enunciados: CjfEnunciado[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const numero = parseInt(m[1], 10);
    if (numero < 1 || numero > 60) continue; // sanity

    let texto = m[2];
    // Remove tags HTML internas
    texto = texto.replace(/<[^>]+>/g, ' ');
    texto = decodeHtml(texto);
    texto = texto.replace(/\s+/g, ' ').trim();

    // Skip se for muito curto (pode ser referência, não o enunciado)
    if (texto.length < 50) continue;

    // Detecta duplicatas (alguns regexs podem capturar mesma posição duas vezes)
    if (enunciados.some((e) => e.numero === numero && e.texto === texto)) continue;

    const simposio: 1 | 2 = numero <= 25 ? 1 : 2;
    const ano = simposio === 1 ? 2022 : 2023;

    enunciados.push({
      numero,
      simposio,
      ano,
      texto,
      fonte: SOURCE_URL,
    });
  }

  // Dedup por numero (fica com a primeira ocorrência)
  const seen = new Map<number, CjfEnunciado>();
  for (const e of enunciados) {
    if (!seen.has(e.numero)) seen.set(e.numero, e);
  }
  const final = Array.from(seen.values()).sort((a, b) => a.numero - b.numero);

  console.log(`Encontrados ${final.length} enunciados únicos\n`);
  console.log('Primeiros 3:');
  for (const e of final.slice(0, 3)) {
    console.log(`  Enunciado ${e.numero} (Simpósio ${e.simposio}/${e.ano}):`);
    console.log(`    ${e.texto.slice(0, 150)}...`);
  }
  console.log('\nÚltimos 3:');
  for (const e of final.slice(-3)) {
    console.log(`  Enunciado ${e.numero} (Simpósio ${e.simposio}/${e.ano}):`);
    console.log(`    ${e.texto.slice(0, 150)}...`);
  }

  console.log('\nDistribuição:');
  const simp1 = final.filter((e) => e.simposio === 1).length;
  const simp2 = final.filter((e) => e.simposio === 2).length;
  console.log(`  1º Simpósio (1-25/2022): ${simp1}`);
  console.log(`  2º Simpósio (26-54/2023): ${simp2}`);

  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(process.cwd(), 'docs', 'audits');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}-cjf-enunciados-scraped.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { scrapedAt: new Date().toISOString(), source: SOURCE_URL, total: final.length, enunciados: final },
      null,
      2
    )
  );
  console.log(`\n✅ JSON salvo: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
