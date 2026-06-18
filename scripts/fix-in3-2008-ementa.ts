/**
 * Corrige a ementa da IN MP nº 3/2008 (id 8fac1e34...), que estava com ~19.853
 * caracteres reproduzindo o corpo do ato (começava em "I - identificação do nome...").
 *
 * Ementa oficial (gov.br/compras): "Dispõe sobre a classificação, utilização,
 * especificação, identificação, aquisição e alienação de veículos oficiais e dá
 * outras providências."
 *
 * Segue a skill atos-normativos-import: normalizeScrapedText + validateActContent
 * antes de gravar; invalida cache de atos no fim. O `content` (texto integral) é
 * preservado intacto.
 *
 * Uso: npx tsx scripts/fix-in3-2008-ementa.ts [--apply]
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { CacheInvalidation } from '../lib/cache/redis-client';

const APPLY = process.argv.includes('--apply');
const EMENTA_OFICIAL =
  'Dispõe sobre a classificação, utilização, especificação, identificação, aquisição e alienação de veículos oficiais e dá outras providências.';

async function main() {
  const act = await prisma.legislativeAct.findFirst({
    where: { type: 'in', year: 2008, number: '3' },
    select: { id: true, fullNumber: true, ementa: true, content: true, officialUrl: true, embeddingStatus: true },
  });
  if (!act) { console.log('IN 3/2008 não encontrada.'); await prisma.$disconnect(); return; }

  console.log(`\n=== Corrigir ementa — ${act.fullNumber} (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);
  console.log('Ementa ATUAL:', act.ementa.length, 'chars —', JSON.stringify(act.ementa.slice(0, 120)) + '...');
  console.log('Início do content (confirmação de fidelidade):');
  console.log('  ', JSON.stringify((act.content || '').slice(0, 260)));

  const ementa = normalizeScrapedText(EMENTA_OFICIAL);
  const v = validateActContent({ url: act.officialUrl || undefined, ementa, content: act.content || undefined });
  console.log('\nEmenta NOVA:', ementa.length, 'chars —', JSON.stringify(ementa));
  console.log('Validação:', v.ok ? 'OK' : 'FALHOU', '| errors:', v.errors, '| warnings:', v.warnings);
  if (!v.ok) { console.log('❌ Validação falhou — abortando.'); await prisma.$disconnect(); return; }

  if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); await prisma.$disconnect(); return; }

  await prisma.legislativeAct.update({
    where: { id: act.id },
    data: { ementa, embeddingStatus: 'pending' }, // content preservado; reembedar pois a ementa mudou
  });
  console.log('\n✅ Ementa atualizada e embeddingStatus=pending.');

  try {
    const n = await CacheInvalidation.legislativeActs();
    await CacheInvalidation.vectorSearch();
    console.log(`🗑️  Cache de atos invalidado (acts=${n}, vector).`);
  } catch (e) { console.log(`⚠️  cache: ${e instanceof Error ? e.message : String(e)}`); }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
