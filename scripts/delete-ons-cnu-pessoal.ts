/**
 * Exclui 3 ONs antigas da CNU/CGU/AGU que são de tema de PESSOAL (fora do
 * escopo de licitações/contratos do site), a pedido — 2026-07-11:
 *   - ON 03/2016 — estágio probatório + licença gestante/paternidade
 *   - ON 07/2017 — estágio probatório (Lei 8.112/90)
 *   - ON 08/2018 — heteroidentificação de cotistas em concurso público
 *
 * MANTIDAS (são de licitações, verificadas no texto integral): ON 01/2016
 * (pregão/cessão de uso), 02/2016 (dispensa/remanescente de obra), 04/2016
 * (pesquisa de preços), 06/2017 (competência da CNU — mantida por ora).
 *
 * DocumentChunk, DocumentVersion e DocumentMetaDou têm onDelete: Cascade,
 * então o delete do Document remove os relacionados automaticamente.
 *
 * Uso:
 *   npx tsx scripts/delete-ons-cnu-pessoal.ts            # dry-run
 *   npx tsx scripts/delete-ons-cnu-pessoal.ts --apply    # exclui + invalida cache
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';
import { CacheInvalidation } from '../lib/cache/redis-client';

const APPLY = process.argv.includes('--apply');
const TARGETS = [
  { onNumber: 3, onYear: 2016 },
  { onNumber: 7, onYear: 2017 },
  { onNumber: 8, onYear: 2018 },
];

async function main() {
  console.log(`\n=== Excluir ONs CNU de pessoal (3/2016, 7/2017, 8/2018) — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===\n`);

  const docs = await prisma.document.findMany({
    where: { category: 'orientacao-normativa', OR: TARGETS },
    select: { id: true, title: true, onNumber: true, onYear: true, isPublic: true },
  });

  if (docs.length === 0) {
    console.log('Nenhum documento encontrado (já excluídos?).');
    await prisma.$disconnect();
    return;
  }

  for (const d of docs) {
    const chunks = await prisma.documentChunk.count({ where: { documentId: d.id } });
    const versions = await prisma.documentVersion.count({ where: { documentId: d.id } });
    console.log(`• ON ${d.onNumber}/${d.onYear} [${d.isPublic ? 'público' : 'histórico'}] "${d.title}" (id=${d.id}) — ${chunks} chunks, ${versions} versões`);
  }

  // Trava de segurança: só devem existir as 3 ONs alvo (uma por par). Se aparecer
  // algo inesperado (ex.: número/ano coincidindo com outra categoria), aborta.
  const unexpected = docs.filter(
    (d) => !TARGETS.some((t) => t.onNumber === d.onNumber && t.onYear === d.onYear)
  );
  if (unexpected.length > 0) {
    console.log(`\n⚠️  ABORTADO: ${unexpected.length} documento(s) fora do alvo apareceram na query. Revise antes.`);
    await prisma.$disconnect();
    return;
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN: ${docs.length} documento(s) seriam excluídos (com chunks/versões em cascata). Rode com --apply.`);
    await prisma.$disconnect();
    return;
  }

  const ids = docs.map((d) => d.id);
  const del = await prisma.document.deleteMany({ where: { id: { in: ids } } });
  console.log(`\n🗑️  ${del.count} documento(s) excluído(s) (chunks/versões removidos em cascata).`);

  try {
    await CacheInvalidation.courseDocuments();
    await CacheInvalidation.vectorSearch();
    await CacheInvalidation.synthesizedAnswers();
    await CacheInvalidation.douStats();
    console.log('🗑️  Cache invalidado (docs, vector, synth, douStats).');
  } catch (e) {
    console.log(`⚠️  Falha ao invalidar cache: ${e instanceof Error ? e.message : String(e)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
