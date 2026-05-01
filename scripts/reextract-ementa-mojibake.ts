/**
 * Re-extrai a ementa dos atos com mojibake (U+FFFD) na ementa atual.
 *
 * Pra cada ato afetado:
 *   1. Faz fetch do officialUrl com detectCharsetFromResponse (latin1 sniff).
 *   2. Carrega com cheerio.
 *   3. Procura o primeiro parágrafo que comece com verbo característico de
 *      ementa: "Dispõe", "Altera", "Regulamenta", "Estabelece", "Aprova",
 *      "Cria", "Institui", "Define", "Reorganiza", "Confere", "Aprova",
 *      "Acrescenta", "Revoga".
 *   4. Se não achar, fallback: primeiro <p> depois do número do ato.
 *   5. Normaliza com normalizeScrapedText.
 *   6. Compara com a ementa existente — se a nova está limpa (sem U+FFFD)
 *      e tem >= 30 chars, usa ela; senão, reporta failure.
 *
 * Modos: dry-run (default) | --apply
 */
import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import {
  detectCharsetFromResponse,
  normalizeScrapedText,
} from '../lib/legislative-scrapers/normalize';
import { CacheInvalidation } from '../lib/cache/redis-client';

// Verbos típicos de ementa. NÃO inclui "Lei" / "Decreto" — esses aparecem
// apenas no título do ato e capturam falso positivo.
const EMENTA_VERB_PATTERN =
  /^(Disp[õo]e|Altera|Regulamenta|Estabelece|Aprova|Cria|Institui|Define|Reorganiza|Confere|Acrescenta|Estatui|Dá nova redação|Dispoe|Revoga\s+(a|o)\s|Concede|Reconhece|Autoriza|Inclui|Suspende|Prorroga)/i;

// Marcadores que NUNCA são ementa (título, anotação, header institucional).
const NOT_EMENTA_PATTERN =
  /^(DECRETO|LEI(\s+COMPLEMENTAR)?|MEDIDA PROVISÓRIA|PORTARIA|INSTRUÇÃO NORMATIVA|RESOLUÇÃO|DECRETO[\s-]LEI)\s+N[ºo°]?\s+\d|^\(?\s*Revogad[oa]\s+pel|^\(?\s*Vigência|^Vide\s|^Texto compilado|^Veto|^Mensagem de veto|^Presidência|^Casa Civil|^Subchefia|^Brasão|^Secretaria|^Republicad[oa]/i;

async function fetchPageDecoded(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const charset = detectCharsetFromResponse(res.headers.get('content-type'), buffer);
    return new TextDecoder(charset, { fatal: false }).decode(buffer);
  } catch (e) {
    console.error('   fetch err:', (e as Error).message);
    return null;
  }
}

function extractEmenta(html: string): string | null {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, iframe').remove();

  // Coleta de candidatos: cada `<p>` (preferencialmente). Cheerio retorna
  // duplicidade quando `<font>` está dentro de `<p>` — dedupe pelo texto.
  const seen = new Set<string>();
  const allP: string[] = [];
  for (const el of $('p, font').get()) {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (!t || t.length < 30 || t.length > 1500) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    allP.push(t);
  }

  // Heurística 1: primeiro `<p>` que começa com verbo de ementa e NÃO casa
  // com NOT_EMENTA_PATTERN.
  for (const t of allP) {
    if (NOT_EMENTA_PATTERN.test(t)) continue;
    if (EMENTA_VERB_PATTERN.test(t)) return t;
  }

  // Heurística 2: pega o primeiro parágrafo APÓS o título oficial do ato
  // (que começa com "DECRETO Nº ..." ou "LEI Nº ...").
  let foundTitle = false;
  for (const t of allP) {
    if (foundTitle && !NOT_EMENTA_PATTERN.test(t)) {
      // exclui datas tipo "Brasília, 16 de fevereiro de 1996" e assinaturas
      if (/^Brasília,/i.test(t)) continue;
      if (t === t.toUpperCase() && t.length < 80) continue; // assinatura ALL CAPS
      return t;
    }
    if (/^(DECRETO|LEI(\s+COMPLEMENTAR)?|DECRETO[\s-]LEI|MEDIDA PROVISÓRIA|PORTARIA|INSTRUÇÃO NORMATIVA|RESOLUÇÃO)\s+N[ºo°]?\s+\d/i.test(t)) {
      foundTitle = true;
    }
  }

  return null;
}

interface Result {
  fullNumber: string;
  id: string;
  status: 'fixed' | 'failed' | 'no-change';
  before: string;
  after?: string;
  reason?: string;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const acts = await prisma.legislativeAct.findMany({
    where: { ementa: { contains: '�' } },
    select: { id: true, fullNumber: true, ementa: true, officialUrl: true },
  });

  console.log(`📋 ${acts.length} atos com mojibake na ementa\n   modo: ${apply ? '✅ APPLY' : '🔒 dry-run'}\n`);

  const results: Result[] = [];

  for (const a of acts) {
    if (!a.officialUrl) {
      results.push({ fullNumber: a.fullNumber, id: a.id, status: 'failed', before: a.ementa, reason: 'sem officialUrl' });
      continue;
    }
    console.log(`── ${a.fullNumber} (${a.id})`);
    console.log(`   url: ${a.officialUrl}`);

    const html = await fetchPageDecoded(a.officialUrl);
    if (!html) {
      console.log(`   ❌ fetch falhou`);
      results.push({ fullNumber: a.fullNumber, id: a.id, status: 'failed', before: a.ementa, reason: 'fetch falhou' });
      continue;
    }

    const candidate = extractEmenta(html);
    if (!candidate) {
      console.log(`   ❌ não consegui extrair ementa`);
      results.push({ fullNumber: a.fullNumber, id: a.id, status: 'failed', before: a.ementa, reason: 'extração falhou' });
      continue;
    }

    const newEmenta = normalizeScrapedText(candidate);
    if (newEmenta.includes('�')) {
      console.log(`   ❌ nova ementa ainda tem U+FFFD — fetch decodificou errado`);
      results.push({ fullNumber: a.fullNumber, id: a.id, status: 'failed', before: a.ementa, reason: 'mojibake persistiu' });
      continue;
    }
    if (newEmenta.length < 30) {
      console.log(`   ❌ ementa muito curta (${newEmenta.length} chars): ${JSON.stringify(newEmenta)}`);
      results.push({ fullNumber: a.fullNumber, id: a.id, status: 'failed', before: a.ementa, reason: 'ementa curta' });
      continue;
    }

    console.log(`   ✅ extraída: ${JSON.stringify(newEmenta.slice(0, 200))}`);
    results.push({ fullNumber: a.fullNumber, id: a.id, status: 'fixed', before: a.ementa, after: newEmenta });

    if (apply) {
      await prisma.legislativeAct.update({
        where: { id: a.id },
        data: { ementa: newEmenta },
      });
      console.log(`   💾 gravado`);
    }
    // delay para não martelar planalto
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('\n════════════════════════════════════════');
  const fixed = results.filter((r) => r.status === 'fixed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  console.log(`   ✅ ${fixed} ementas corrigidas${apply ? '' : ' (dry-run, não gravadas)'}`);
  console.log(`   ❌ ${failed} falharam`);
  if (failed > 0) {
    console.log(`\n⚠️  Falhas (precisam de revisão manual):`);
    for (const r of results.filter((x) => x.status === 'failed')) {
      console.log(`   - ${r.fullNumber}: ${r.reason}`);
    }
  }

  // Invalida cache pra que listagens públicas reflitam imediatamente.
  if (apply && fixed > 0) {
    console.log(`\n🔄 Invalidando cache...`);
    const removed = await CacheInvalidation.legislativeActs();
    console.log(`✅ Cache invalidado (${removed} keys).`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
