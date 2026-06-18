/**
 * Exclui as ONs 104/2026 e 106/2026 (temas de pessoal: estágio probatório e
 * readaptação) importadas em 2026-06-18, a pedido — fora do escopo de
 * licitações/contratos do site.
 *
 * DocumentChunk, DocumentVersion e DocumentMetaDou têm onDelete: Cascade,
 * então o delete do Document remove os relacionados automaticamente.
 *
 * Uso:
 *   npx tsx scripts/delete-ons-104-106.ts            # dry-run
 *   npx tsx scripts/delete-ons-104-106.ts --apply    # exclui + invalida cache
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';
import { CacheInvalidation } from '../lib/cache/redis-client';

const APPLY = process.argv.includes('--apply');
const TARGETS = [104, 106];

async function main() {
  console.log(`\n=== Excluir ONs ${TARGETS.join(', ')}/2026 — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===\n`);

  const docs = await prisma.document.findMany({
    where: { category: 'orientacao-normativa', onYear: 2026, onNumber: { in: TARGETS } },
    select: { id: true, title: true, onNumber: true },
  });

  if (docs.length === 0) {
    console.log('Nenhum documento encontrado (já excluídos?).');
    await prisma.$disconnect();
    return;
  }

  for (const d of docs) {
    const chunks = await prisma.documentChunk.count({ where: { documentId: d.id } });
    const versions = await prisma.documentVersion.count({ where: { documentId: d.id } });
    console.log(`• ${d.title} (id=${d.id}) — ${chunks} chunks, ${versions} versões`);
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN: ${docs.length} documento(s) seriam excluídos (com chunks/versões em cascata). Rode com --apply.`);
    await prisma.$disconnect();
    return;
  }

  const ids = docs.map((d) => d.id);
  const del = await prisma.document.deleteMany({
    where: { id: { in: ids } },
  });
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
