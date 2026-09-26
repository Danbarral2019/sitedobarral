/**
 * Mede o classificador editorial do DOU contra o gabarito do editor.
 *
 * Amostra: todos os aprovados + todos os casos das faixas núcleo/limítrofe
 * + N rejeitados "fora" que passam pelo pré-filtro (sorteio com semente fixa).
 * Busca o texto oficial de cada ato (cache em eval/reports/.dou-textos-cache.json).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/eval-dou-classificador.ts [--fora 80] [--sem-texto]
 *
 * Custo: ~1 chamada Gemini Flash a cada 5 itens + 1 fetch ao DOU por item (só na 1ª vez).
 */
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import gabarito from '../eval/dou-triagem-2026-09.json';
import { motivoForaDeEscopo } from '../lib/dou-escopo-prefiltro';
import { classifyEditorialBatch, EDITORIAL_PROMPT_VERSION } from '../lib/dou-editorial-classifier';
import { scrapeContent } from '../lib/dou-scraper';

const CACHE = 'eval/reports/.dou-textos-cache.json';
const LIMIAR = 50;
const argFora = process.argv.indexOf('--fora');
const nFora = argFora > 0 ? Number(process.argv[argFora + 1]) : 80;
const semTexto = process.argv.includes('--sem-texto');

function sorteio<T>(arr: T[], n: number, semente = 42): T[] {
  let s = semente;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  return [...arr].sort(() => rnd() - 0.5).slice(0, n);
}

async function main() {
  const itens = gabarito.itens;
  const duros = itens.filter((i) => i.faixaProposta !== 'fora');
  const fora = sorteio(itens.filter((i) => i.faixaProposta === 'fora' && !motivoForaDeEscopo(i)), nFora);
  const amostra = [...duros, ...fora];

  const cache: Record<string, string> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  if (!semTexto) {
    for (const it of amostra) {
      if (cache[it.url] !== undefined) continue;
      const r = await scrapeContent(it.url).catch(() => null);
      cache[it.url] = r?.conteudo ?? '';
      writeFileSync(CACHE, JSON.stringify(cache));
      await new Promise((res) => setTimeout(res, 500));
    }
  }

  const notas: number[] = [];
  for (let i = 0; i < amostra.length; i += 5) {
    const lote = amostra.slice(i, i + 5);
    const r = await classifyEditorialBatch(
      lote.map((it) => ({ title: it.title, abstract: it.abstract, hierarchyStr: it.hierarchyStr ?? '', fullText: semTexto ? null : cache[it.url] })),
    );
    notas.push(...r.classifications.map((c) => c.score));
  }

  const linhas = amostra.map((it, k) => ({ it, nota: notas[k], entra: notas[k] >= LIMIAR }));
  const ap = linhas.filter((l) => l.it.veredito === 'aprovar');
  const rej = linhas.filter((l) => l.it.veredito === 'rejeitar');
  const semTextoN = amostra.filter((it) => !cache[it.url]).length;
  console.log(`Prompt ${EDITORIAL_PROMPT_VERSION} ${semTexto ? 'SEM texto' : 'COM texto'} | amostra ${amostra.length} (${semTextoN} sem texto obtido) | limiar ${LIMIAR}`);
  console.log(`Aprovados que chegam à fila: ${ap.filter((l) => l.entra).length}/${ap.length}`);
  for (const faixa of ['nucleo', 'limitrofe', 'fora']) {
    const f = rej.filter((l) => l.it.faixaProposta === faixa);
    if (f.length) console.log(`Rejeitados (${faixa}) que ainda chegam à fila: ${f.filter((l) => l.entra).length}/${f.length}`);
  }
  console.log('\nAprovados:');
  ap.forEach((l) => console.log(`  ${l.entra ? '✓' : '✗'} ${String(l.nota).padStart(3)} ${l.it.title}`));
  console.log('\nRejeitados que passariam:');
  rej.filter((l) => l.entra).forEach((l) => console.log(`  ${String(l.nota).padStart(3)} [${l.it.faixaProposta}] ${l.it.title}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
