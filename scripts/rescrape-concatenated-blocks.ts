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
/** concat = blocos fundidos · dup = conteúdo repetido · ambos = os dois */
const ALVO = (process.argv.find(a => a.startsWith('--alvo='))?.split('=')[1] ?? 'ambos') as 'concat' | 'dup' | 'ambos';
const DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Conteúdo repetido: páginas do gov.br/compras que trazem o mesmo id duas vezes
 * faziam o extrator concatenar as duas cópias (corrigido por `pickOne`).
 */
function detectDuplicado(c: string): string | null {
  const t = c.replace(/\s+/g, ' ').trim();
  if (t.length < 200) return null;
  const meio = Math.floor(t.length / 2);
  const prim = t.slice(0, meio).trim();
  if (prim.length > 100 && t.slice(meio).trim().startsWith(prim.slice(0, Math.min(300, prim.length - 1)))) {
    return 'texto repetido 2x';
  }
  const amostra = t.slice(0, 250);
  const idx = t.indexOf(amostra, 250);
  return idx > 0 ? `bloco inicial reaparece na posição ${idx}` : null;
}

/** Assinaturas de dois blocos irmãos fundidos sem separador. */
const CONCAT_SIGNATURES: { name: string; re: RegExp }[] = [
  { name: 'texto colado em "Art. N"', re: /[a-zà-úçãõáéíóúâêô0-9)]Art\.\s*\d/ },
  { name: 'ponto-e-vírgula colado em inciso', re: /;[IVXLC]+\s*[-–]\s/ },
  { name: 'texto colado em CAPÍTULO/SEÇÃO/TÍTULO/ANEXO', re: /[a-zà-ú0-9)](CAPÍTULO|SEÇÃO|TÍTULO|ANEXO)\s/ },
  { name: 'texto colado em "Parágrafo único"', re: /[a-zà-ú0-9)]Parágrafo único/ },
  // "ANTONIO PAULO VOGEL DE MEDEIROSSecretário de Gestão" — <p>NOME</p><p>Cargo</p> fundidos
  { name: 'assinatura colada no cargo', re: /[A-ZÀ-Ú]{3,}(Secretári|Ministr|Diretor|President|Coordenador|Chefe|Superintendent|Procurador|Advogad|Assessor)[aoe]/ },
];

/**
 * Rótulos cuja numeração é SEMPRE romana (ou "ÚNICO/ÚNICA"). ANEXO fica de
 * fora aqui de propósito: admite letra ("ANEXO A") e título descritivo ("ANEXO
 * QUADRO DE PREÇOS"), então um token não-romano ali é legítimo, não cola.
 * O caso de ANEXO tem regra própria em `detectAnexoGlue`.
 */
const ROMAN_LABELED = /\b(CAPÍTULO|SEÇÃO|SECÇÃO|TÍTULO|SUBSEÇÃO)[ \t]+([A-ZÀ-Ú]+)/g;
const VALID_ORDINAL = /^([IVXLCDM]+|ÚNICO|ÚNICA)$/;
const ROMAN_ONLY = /^[IVXLCDM]+$/;

/**
 * "ANEXO IDEFINIÇÕES" = "ANEXO I" + "DEFINIÇÕES" fundidos.
 *
 * Excluir ANEXO por completo do teste de rótulo (como se fazia) criava um FALSO
 * NEGATIVO: a IN SEGES/MP 5/2017 — a mais consultada do acervo — carregava esse
 * defeito sem ser detectada. A regra aqui é mais estreita que a dos outros
 * rótulos: o token precisa COMEÇAR com numeral romano e ainda sobrar uma palavra
 * de 4+ letras. Assim "ANEXO A", "ANEXO VIII" e "ANEXO QUADRO" (que não começa
 * por romano) seguem passando.
 */
function detectAnexoGlue(content: string): string | null {
  const re = /\bANEXO[ \t]+([A-ZÀ-Ú]{5,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const tok = m[1];
    if (ROMAN_ONLY.test(tok)) continue;
    const prefixo = tok.match(/^[IVXLCDM]+/)?.[0] ?? '';
    if (prefixo && tok.length - prefixo.length >= 4) {
      return `ANEXO colado ("${tok.slice(0, 24)}")`;
    }
  }
  return null;
}

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
  if (ALVO === 'concat' || ALVO === 'ambos') {
    for (const s of CONCAT_SIGNATURES) {
      if (s.re.test(content)) return s.name;
    }
    const glue = detectHeadingGlue(content);
    if (glue) return glue;
    const anexo = detectAnexoGlue(content);
    if (anexo) return anexo;
    // "1. Do ato convocatório:1.1. O ato…" — item numerado colado no anterior
    if (/:\d+\.\d+\.\s*[A-ZÀ-Úa-zà-ú]/.test(content)) return 'item numerado colado após ":"';
  }
  if (ALVO === 'dup' || ALVO === 'ambos') {
    const dup = detectDuplicado(content);
    if (dup) return `conteúdo duplicado — ${dup}`;
  }
  return null;
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
