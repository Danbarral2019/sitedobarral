/**
 * Re-scrape de atos cujo `content` foi extraído com blocos HTML concatenados.
 *
 * Causa (corrigida em `lib/legislative-scrapers/normalize.ts#blockAwareText`):
 * `Cheerio.text()` concatena o textContent de todos os descendentes sem
 * separador, então `<p>CAPÍTULO I</p><p>DISPOSIÇÕES</p>` virava
 * "CAPÍTULO IDISPOSIÇÕES". O texto fundido quebra a renderização (o heading
 * engole o artigo seguinte) e degrada o chunking dos embeddings.
 *
 * Atos com `scrapeStatus: 'manual'` são preservados — o conteúdo deles veio de
 * import manual (Bundles B/C) e re-scrapear sobrescreveria texto bom.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/rescrape-concatenated-blocks.ts --dry-run
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/rescrape-concatenated-blocks.ts
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? 0);
const DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Assinaturas de dois blocos irmãos fundidos sem separador. */
const CONCAT_SIGNATURES: { name: string; re: RegExp }[] = [
  { name: 'texto colado em "Art. N"', re: /[a-zà-úçãõáéíóúâêô0-9)]Art\.\s*\d/ },
  { name: 'ponto-e-vírgula colado em inciso', re: /;[IVXLC]+\s*[-–]\s/ },
  { name: 'texto colado em CAPÍTULO/SEÇÃO/TÍTULO/ANEXO', re: /[a-zà-ú0-9)](CAPÍTULO|SEÇÃO|TÍTULO|ANEXO)\s/ },
  { name: 'texto colado em "Parágrafo único"', re: /[a-zà-ú0-9)]Parágrafo único/ },
];

/**
 * Rótulos cuja numeração é SEMPRE romana (ou "ÚNICO/ÚNICA"). ANEXO fica de
 * fora de propósito: admite letra ("ANEXO A") e título descritivo ("ANEXO
 * QUADRO DE PREÇOS"), então um token não-romano ali é legítimo, não cola.
 */
const ROMAN_LABELED = /\b(CAPÍTULO|SEÇÃO|SECÇÃO|TÍTULO|SUBSEÇÃO)\s+([A-ZÀ-Ú]+)/g;
const VALID_ORDINAL = /^([IVXLCDM]+|ÚNICO|ÚNICA)$/;

/**
 * "CAPÍTULO IDISPOSIÇÕES" — o token após o rótulo não é numeral romano válido,
 * logo o texto do bloco seguinte foi concatenado nele.
 *
 * Detectar com `/CAPÍTULO\s+[IVXLC]+[A-ZÀ-Ú]{3}/` dá FALSO POSITIVO em numerais
 * legítimos de 4+ letras: em "CAPÍTULO VIII" o `[IVXLC]+` casa "V" e o `{3}`
 * casa "III". Por isso o token é isolado e validado inteiro.
 */
function detectHeadingGlue(content: string): string | null {
  ROMAN_LABELED.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROMAN_LABELED.exec(content)) !== null) {
    if (!VALID_ORDINAL.test(m[2])) {
      return `${m[1]} colado em maiúsculas ("${m[2].slice(0, 24)}")`;
    }
  }
  return null;
}

function detect(content: string): string | null {
  for (const s of CONCAT_SIGNATURES) {
    if (s.re.test(content)) return s.name;
  }
  return detectHeadingGlue(content);
}

async function main() {
  const all = await prisma.legislativeAct.findMany({
    where: {
      officialUrl: { not: null },
      content: { not: null },
      scrapeStatus: { not: 'manual' },
    },
    select: { id: true, fullNumber: true, officialUrl: true, content: true },
  });

  const targets: { id: string; fullNumber: string; officialUrl: string; reason: string }[] = [];
  for (const a of all) {
    const reason = detect(a.content ?? '');
    if (reason) {
      targets.push({ id: a.id, fullNumber: a.fullNumber, officialUrl: a.officialUrl!, reason });
    }
  }

  const queue = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;

  console.log(`Analisados ${all.length} atos elegíveis (scrapeStatus != 'manual').`);
  console.log(`Afetados: ${targets.length}${LIMIT > 0 ? ` — processando ${queue.length} (--limit=${LIMIT})` : ''}`);
  console.log(`dry-run: ${DRY_RUN}\n`);
  for (const t of queue) console.log(`  [${t.reason}] ${t.fullNumber}`);

  if (DRY_RUN) return;

  let ok = 0, fail = 0;
  const failures: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i];
    console.log(`\n[${i + 1}/${queue.length}] ${t.fullNumber}`);
    try {
      const result = await scrapeAndIndexAct(t.id);
      if (result.scraped) {
        console.log(`  ✓ scraped${result.indexed ? ' + indexed' : ' (SEM reindex)'}`);
        ok++;
      } else {
        console.log(`  ✗ ${result.error ?? 'erro desconhecido'}`);
        failures.push(`${t.fullNumber}: ${result.error ?? 'erro desconhecido'}`);
        fail++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ exceção: ${msg}`);
      failures.push(`${t.fullNumber}: ${msg}`);
      fail++;
    }
    if (i < queue.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nResumo: ${ok} OK, ${fail} falharam, ${queue.length} total.`);
  if (failures.length > 0) {
    console.log('\nFalhas:');
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main()
  .catch((err) => { console.error('ERRO:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
