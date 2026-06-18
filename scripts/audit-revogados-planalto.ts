/**
 * Auditoria de revogação TOTAL usando o Planalto como fonte de verdade.
 *
 * O cabeçalho das páginas do planalto.gov.br marca "Revogado pelo Decreto/Lei nº ..."
 * APENAS quando o ato foi revogado integralmente (revogação parcial não recebe essa
 * marcação no topo). Isso evita o ruído das relações 'revoga' (que incluem parciais
 * e falsos positivos).
 *
 * Para cada ato com officialUrl do Planalto: baixa a página, detecta a marcação de
 * revogação no cabeçalho e propõe revoked=true + revokedNote.
 *
 * EXCEÇÕES (decisão do usuário): Lei 8.666/93, Lei 10.520/02 e Lei 12.462/11 são
 * mantidas visíveis (revogadas pela 14.133, mas centrais no estudo) — nunca marcadas.
 *
 * Uso: npx tsx scripts/audit-revogados-planalto.ts [--apply]
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { CacheInvalidation } from '../lib/cache/redis-client';

const APPLY = process.argv.includes('--apply');

// Atos a NUNCA ocultar:
// - 8.666/93, 10.520/02, 12.462/11: revogados pela 14.133 mas centrais no estudo (decisão do usuário)
// - 4.657/1942: é a LINDB; "vigente". A Lei 12.376/2010 apenas alterou a ementa (não revogou) —
//   o Planalto exibe marcação que confunde o detector. Falso positivo conhecido.
const KEEP_VISIBLE = new Set(['8.666', '10.520', '12.462', '4.657']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Detecta marcação de revogação total no cabeçalho do Planalto. */
function detectRevogacao(html: string): string | null {
  const $ = cheerio.load(html);
  $('script, style').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const head = text.slice(0, 1500); // só o cabeçalho, antes do corpo
  // Ex.: "Revogado pelo Decreto nº 12.785, de 2025" / "Revogada pela Lei nº ..."
  const m = head.match(/Revogad[oa]\s+pel[oa]\s+(?:Decreto-Lei|Decreto|Lei Complementar|Lei|Medida Provis[óo]ria)\s*n?[ºo°.]*\s*[\d.]+(?:[,\s]+de\s+\d{4})?/i);
  if (m) return m[0].replace(/\s+/g, ' ').trim();
  // Revogação só de "texto" (mantida vigência por outro) — não marcar como total
  return null;
}

async function main() {
  console.log(`\n=== Auditoria de revogados via Planalto — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===\n`);

  const acts = await prisma.legislativeAct.findMany({
    where: { officialUrl: { contains: 'planalto.gov.br' } },
    select: { id: true, fullNumber: true, number: true, officialUrl: true, revoked: true },
    orderBy: { hierarchyLevel: 'asc' },
  });
  console.log(`Atos com URL do Planalto: ${acts.length}\n`);

  const revogados: { fullNumber: string; note: string; id: string }[] = [];
  const mantidosExcecao: string[] = [];
  let erros = 0;

  for (const act of acts) {
    if (KEEP_VISIBLE.has(act.number)) { mantidosExcecao.push(act.fullNumber); continue; }
    try {
      const res = await fetch(act.officialUrl!, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (!res.ok) { erros++; continue; }
      const buf = await res.arrayBuffer();
      // Planalto antigo usa ISO-8859-1
      const html = new TextDecoder('latin1').decode(buf);
      const note = detectRevogacao(html);
      if (note) {
        revogados.push({ fullNumber: act.fullNumber, note, id: act.id });
        console.log(`  🚫 ${act.fullNumber} — ${note}`);
      }
    } catch { erros++; }
    await sleep(150);
  }

  console.log(`\n${'='.repeat(64)}`);
  console.log(`Detectados REVOGADOS (total): ${revogados.length} | exceções mantidas: ${mantidosExcecao.length} (${mantidosExcecao.join(', ') || '—'}) | erros de fetch: ${erros}`);

  if (!APPLY) {
    console.log('\nDRY-RUN. Revise a lista acima. Rode com --apply para marcar revoked=true.');
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const r of revogados) {
    await prisma.legislativeAct.update({ where: { id: r.id }, data: { revoked: true, revokedNote: r.note } });
    updated++;
  }
  console.log(`\n✅ ${updated} atos marcados como revogados.`);
  try {
    const n = await CacheInvalidation.legislativeActs();
    await CacheInvalidation.vectorSearch();
    console.log(`🗑️  Cache invalidado (acts=${n}, vector).`);
  } catch (e) { console.log(`⚠️  cache: ${e instanceof Error ? e.message : String(e)}`); }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
