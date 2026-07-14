/**
 * Exclui 5 registros LEGADOS de "fundamentação" de ONs (type='pdf', privados,
 * ligados ao Curso 2, com onNumber/onYear NULOS) — duplicatas do registro
 * principal público de cada ON. A pedido (2026-07-14), após investigação:
 *   - dbc7ecac  ON 45/2014  (fundamentacao-on-45)
 *   - 74c4935a  ON 47/2014  (fundamentacao-on-47)
 *   - 280b18c0  ON 4/2009   (fundamentacao-on-04-2009)
 *   - 4918fb23  ON 101/2025 (fundamentacao-on-101)
 *   - e270957c  ON 77/2023  (mislabeled: url=fundamentacao-on-41; vazio; embed FAILED)
 *
 * O registro PRINCIPAL (type='link', público, com onNumber/onYear) de cada ON
 * permanece intacto. DocumentChunk/DocumentVersion/DocumentMetaDou saem em cascata.
 *
 * TRAVA DE SEGURANÇA: só exclui se cada id ainda for pdf + privado + onNumber
 * nulo + categoria orientacao-normativa. Qualquer divergência → ABORTA.
 *
 * Uso:
 *   npx tsx scripts/delete-ons-fundamentacao-legadas.ts            # dry-run
 *   npx tsx scripts/delete-ons-fundamentacao-legadas.ts --apply    # exclui + invalida cache
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';
import { CacheInvalidation } from '../lib/cache/redis-client';

const APPLY = process.argv.includes('--apply');
const TARGET_IDS = [
  'dbc7ecac-a95f-4a3d-91d2-279bbe2eda7c',
  '74c4935a-1fa4-4db6-9517-ef39597b29b5',
  '280b18c0-364d-42cb-b5d9-e930a98b3413',
  '4918fb23-bab1-4abd-a4a5-818c952c8a68',
  'e270957c-36cc-40bb-b486-a0b5476e96ec',
];

async function main() {
  console.log(`\n=== Excluir 5 fundamentações legadas de ON — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===\n`);

  const docs = await prisma.document.findMany({
    where: { id: { in: TARGET_IDS } },
    select: { id: true, title: true, category: true, type: true, isPublic: true, onNumber: true, onYear: true, url: true },
  });

  if (docs.length === 0) {
    console.log('Nenhum dos 5 encontrado (já excluídos?). Nada a fazer.');
    await prisma.$disconnect();
    return;
  }

  // Trava de segurança: confere invariantes de cada registro.
  const violations: string[] = [];
  for (const d of docs) {
    const ok = d.category === 'orientacao-normativa' && d.type === 'pdf' && d.isPublic === false
      && d.onNumber === null && d.onYear === null;
    if (!ok) violations.push(`  ✗ ${d.id} "${d.title}" — cat=${d.category} type=${d.type} public=${d.isPublic} on=${d.onNumber}/${d.onYear}`);
  }
  if (violations.length > 0) {
    console.log('⚠️  ABORTADO: registro(s) fora do invariante esperado (pdf, privado, onNumber nulo):');
    console.log(violations.join('\n'));
    console.log('\nNada foi excluído. Reinvestigue antes.');
    await prisma.$disconnect();
    return;
  }

  for (const d of docs) {
    const chunks = await prisma.documentChunk.count({ where: { documentId: d.id } });
    const versions = await prisma.documentVersion.count({ where: { documentId: d.id } });
    console.log(`• "${d.title}" (id=${d.id.slice(0, 8)}) — ${chunks} chunk(s), ${versions} versão(ões)  ← ${d.url.split('/').pop()}`);
  }
  const faltando = TARGET_IDS.filter((id) => !docs.some((d) => d.id === id));
  if (faltando.length) console.log(`\n(${faltando.length} id(s) já ausentes — idempotente.)`);

  if (!APPLY) {
    console.log(`\nDRY-RUN: ${docs.length} registro(s) seriam excluídos (chunks/versões em cascata). Rode com --apply.`);
    await prisma.$disconnect();
    return;
  }

  const del = await prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
  console.log(`\n🗑️  ${del.count} registro(s) excluído(s) (chunks/versões em cascata).`);

  try {
    await CacheInvalidation.courseDocuments();
    await CacheInvalidation.vectorSearch();
    console.log('🗑️  Cache invalidado (courseDocuments, vectorSearch).');
  } catch (e) {
    console.log('⚠️  Falha ao invalidar cache (não crítico):', e instanceof Error ? e.message : e);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
