/**
 * Fase 7 — Dedup estrutural de Documents duplicados (pareceres/notas/despachos
 * da AGU vindos do CONUNI). Remove cópias EXATAS (mesmo título + url + content),
 * mantendo a mais antiga como canônica. As FKs de Document são onDelete:Cascade
 * (chunks/meta/versões) ou SetNull (Favorite) — a remoção cascateia os chunks.
 *
 * Uso:
 *   npx tsx scripts/dedup-conuni-documents.ts            # dry-run (não remove)
 *   npx tsx scripts/dedup-conuni-documents.ts --apply    # remove de verdade
 *
 * SEMPRE grava backup dos IDs em docs/audits/ antes de remover.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { prisma } from '../lib/prisma';

type Row = { id: string; title: string; url: string | null; uploadedAt: Date; chash: string };

async function main() {
  const apply = process.argv.includes('--apply');

  // Todos os docs em grupos de título duplicado, com hash do content
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT d.id, d.title, d.url, d."uploadedAt", md5(coalesce(d.content,'')) as chash
    FROM "Document" d
    JOIN (
      SELECT title FROM "Document"
      WHERE title IS NOT NULL AND title <> ''
      GROUP BY title HAVING COUNT(*) > 1
    ) dup ON d.title = dup.title
    ORDER BY d.title, d."uploadedAt" ASC
  `;

  // Golden set — nunca remover um ID anotado (segurança extra; esperado 0)
  const golden = JSON.parse(readFileSync('eval/golden-set.json', 'utf8'));
  const goldenIds = new Set<string>();
  for (const q of golden.queries) {
    (q.annotations.relevant || []).forEach((i: string) => goldenIds.add(i));
    (q.annotations.highlyRelevant || []).forEach((i: string) => goldenIds.add(i));
  }

  // Agrupar por título
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (!groups.has(r.title)) groups.set(r.title, []);
    groups.get(r.title)!.push(r);
  }

  const toRemove: { title: string; canonicalId: string; removedId: string; url: string | null }[] = [];
  const skippedNonExact: string[] = [];
  const skippedGolden: string[] = [];

  for (const [title, grp] of groups) {
    // Verifica exatidão: todos com mesma url e mesmo content-hash
    const url0 = grp[0].url ?? '';
    const hash0 = grp[0].chash;
    const allExact = grp.every((g) => (g.url ?? '') === url0 && g.chash === hash0);
    if (!allExact) { skippedNonExact.push(title); continue; }

    // Canônico = mais antigo (ordenado ASC por uploadedAt). Remove o resto.
    const [canonical, ...dupes] = grp;
    for (const d of dupes) {
      if (goldenIds.has(d.id)) { skippedGolden.push(d.id); continue; }
      toRemove.push({ title, canonicalId: canonical.id, removedId: d.id, url: d.url });
    }
  }

  console.log(`Grupos de título duplicado: ${groups.size}`);
  console.log(`Duplicatas EXATAS a remover: ${toRemove.length}`);
  console.log(`Grupos pulados (não-exatos): ${skippedNonExact.length}`);
  console.log(`Duplicatas puladas por estarem no golden: ${skippedGolden.length}`);
  if (skippedNonExact.length) skippedNonExact.slice(0, 10).forEach((t) => console.log(`  não-exato: ${t.slice(0, 70)}`));

  // Backup SEMPRE (antes de qualquer remoção)
  mkdirSync('docs/audits', { recursive: true });
  const backupPath = 'docs/audits/2026-07-07-conuni-dedup-backup.json';
  writeFileSync(backupPath, JSON.stringify({ generatedFor: apply ? 'apply' : 'dry-run', count: toRemove.length, pairs: toRemove }, null, 2), 'utf8');
  console.log(`\nBackup dos pares gravado em ${backupPath}`);

  if (!apply) {
    console.log('\n[DRY-RUN] Nenhuma remoção feita. Amostra (5):');
    toRemove.slice(0, 5).forEach((r) => console.log(`  keep=${r.canonicalId} remove=${r.removedId} — ${r.title.slice(0, 55)}`));
    console.log('\nRode com --apply para remover.');
    return;
  }

  // Remoção (cascade cuida dos chunks/meta/versões)
  let removed = 0, failed = 0;
  for (const r of toRemove) {
    try {
      await prisma.document.delete({ where: { id: r.removedId } });
      removed++;
    } catch (e) {
      failed++;
      console.error(`  FALHA ao remover ${r.removedId}: ${(e as Error).message}`);
    }
  }
  console.log(`\nRemovidos: ${removed} | falhas: ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
