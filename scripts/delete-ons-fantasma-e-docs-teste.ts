/**
 * Remove os registros-fantasma de ON e os documentos de teste da base.
 *
 * Contexto: auditoria 2026-07-15 (docs/audits/2026-07-15-lei-comentada-RESULTADOS.md).
 * Autorizado explicitamente pelo Daniel em 15/07/2026.
 *
 * ALVO 1 — ONs fantasma (57): o cron `import-documents` criava um segundo
 *   registro por ON, com `title` abreviado ("ON 94/2024"), SEM content e SEM url,
 *   convivendo com o canônico ("Orientação Normativa AGU nº 94/2024"). O fantasma
 *   gerava link quebrado (url vazia → /api/documents/[id]/download → 404).
 *
 * ALVO 2 — documentos de teste (5): criados por `scripts/populate-lms-test.ts`
 *   com `url="#teste-..."` (âncora falsa que nunca levou a lugar nenhum).
 *   Vinculados ao Curso 2 (Planejamento das Contratações).
 *
 * ⚠️ CRITÉRIO DE SEGURANÇA: o fantasma é identificado por
 *   `content IS NULL AND url vazia` — NÃO pelo título. Existe uma ON legítima
 *   ("ON 102/2025") com título abreviado mas content=1035 e url válida do DOU:
 *   apagar por título a destruiria. Ela é poupada e deve ser RENOMEADA, não apagada.
 *
 * DocumentChunk tem onDelete: Cascade (schema.prisma:274) — os embeddings dos
 * registros apagados saem junto, sem órfãos.
 *
 * Backup: docs/audits/2026-07-15-backup-pre-delete.json (registros completos).
 *
 * Uso: npx tsx scripts/delete-ons-fantasma-e-docs-teste.ts            # dry-run
 *      npx tsx scripts/delete-ons-fantasma-e-docs-teste.ts --execute  # apaga
 */
import { prisma } from '../lib/prisma';

const EXECUTE = process.argv.includes('--execute');

async function main() {
  console.log(EXECUTE ? '🔴 MODO EXECUÇÃO — vai apagar\n' : '🔵 DRY-RUN — nada será apagado (use --execute)\n');

  // ── ALVO 1: ONs fantasma ───────────────────────────────────────────────────
  const fantasmas = await prisma.document.findMany({
    where: {
      category: 'orientacao-normativa',
      content: null,
      OR: [{ url: '' }, { url: { equals: undefined } }],
    },
    select: { id: true, title: true, url: true, isPublic: true },
  });
  // Guarda extra: só títulos no formato abreviado "ON N/AAAA"
  const alvo1 = fantasmas.filter((d) => /^ON \d{1,3}\/\d{4}$/.test(d.title) && !d.url);
  console.log(`ALVO 1 — ONs fantasma: ${alvo1.length}`);
  for (const d of alvo1.slice(0, 5)) console.log(`   · "${d.title}" (${d.id})`);
  if (alvo1.length > 5) console.log(`   … e mais ${alvo1.length - 5}`);

  // ── ALVO 2: documentos de teste ────────────────────────────────────────────
  const alvo2 = await prisma.document.findMany({
    where: { url: { startsWith: '#teste-' } },
    select: { id: true, title: true, url: true, courseId: true },
  });
  console.log(`\nALVO 2 — documentos de teste: ${alvo2.length}`);
  for (const d of alvo2) console.log(`   · "${d.title}" → url="${d.url}" (curso ${d.courseId})`);

  // ── Poupados (conferência) ─────────────────────────────────────────────────
  const poupados = await prisma.document.findMany({
    where: {
      category: 'orientacao-normativa',
      title: { startsWith: 'ON ' },
      NOT: { content: null },
    },
    select: { title: true, content: true },
  });
  const poupadosAbrev = poupados.filter((d) => /^ON \d{1,3}\/\d{4}$/.test(d.title));
  if (poupadosAbrev.length) {
    console.log(`\n🛟 POUPADOS (título abreviado MAS legítimos — renomear, não apagar): ${poupadosAbrev.length}`);
    for (const d of poupadosAbrev) console.log(`   · "${d.title}" — content=${d.content?.length} chars`);
  }

  const ids = [...alvo1.map((d) => d.id), ...alvo2.map((d) => d.id)];
  console.log(`\n${'─'.repeat(60)}\nTOTAL A APAGAR: ${ids.length}`);

  const chunks = await prisma.documentChunk.count({ where: { documentId: { in: ids } } });
  console.log(`DocumentChunks que saem junto (cascade): ${chunks}`);

  if (!EXECUTE) {
    console.log('\n🔵 DRY-RUN — nada foi apagado. Rode com --execute para aplicar.');
    await prisma.$disconnect();
    return;
  }

  const del = await prisma.document.deleteMany({ where: { id: { in: ids } } });
  console.log(`\n✅ ${del.count} documentos apagados.`);

  const restam = await prisma.document.count({ where: { category: 'orientacao-normativa' } });
  const restamTeste = await prisma.document.count({ where: { url: { startsWith: '#teste-' } } });
  const restamChunks = await prisma.documentChunk.count({ where: { documentId: { in: ids } } });
  console.log(`\nVerificação pós-exclusão:`);
  console.log(`   ONs restantes: ${restam}`);
  console.log(`   Docs de teste restantes: ${restamTeste} (esperado 0)`);
  console.log(`   Chunks órfãos: ${restamChunks} (esperado 0 — cascade)`);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
