/**
 * Aplica normalizeScrapedText em title/description/content de Documents
 * com problemas de formatação (NBSP, zero-width, boilerplate, headers,
 * multi-space).
 *
 * NÃO conserta mojibake U+FFFD — info é irreversível (info original
 * perdida quando byte virou replacement char). Mojibake precisa re-fetch
 * com charset detection. Reportar separadamente.
 *
 * Modos: dry-run | --apply
 */
import { prisma } from '../lib/prisma';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';

interface DocDiff {
  id: string;
  category: string;
  title: string;
  titleChanged: boolean;
  descChanged: boolean;
  contentChanged: boolean;
  byteDelta: number;
}

async function main() {
  const apply = process.argv.includes('--apply');
  // Foco: categorias com problemas conhecidos (auditoria 2026-05-01)
  // Pode ampliar com --all
  const all = process.argv.includes('--all');
  const where = all ? {} : { category: { in: ['decor', 'manual-tcu', 'ato-normativo'] } };

  const docs = await prisma.document.findMany({
    where,
    select: { id: true, category: true, title: true, description: true, content: true },
  });

  console.log(`📋 ${docs.length} documents${apply ? ' (APPLY)' : ' (dry-run)'}\n`);

  const diffs: DocDiff[] = [];
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;
  const mojibakeDocs: { id: string; category: string; title: string; fffdCount: number }[] = [];

  for (const d of docs) {
    const oldTitle = d.title || '';
    const oldDesc = d.description || '';
    const oldContent = d.content || '';

    const newTitle = normalizeScrapedText(oldTitle);
    const newDesc = normalizeScrapedText(oldDesc);
    const newContent = normalizeScrapedText(oldContent);

    const fffdCount = (oldContent.match(/�/g) ?? []).length;
    if (fffdCount > 0) {
      mojibakeDocs.push({ id: d.id, category: d.category, title: oldTitle, fffdCount });
    }

    const titleChanged = newTitle !== oldTitle;
    const descChanged = newDesc !== oldDesc;
    const contentChanged = newContent !== oldContent;
    if (!titleChanged && !descChanged && !contentChanged) continue;

    const before = oldTitle.length + oldDesc.length + oldContent.length;
    const after = newTitle.length + newDesc.length + newContent.length;
    totalBytesBefore += before;
    totalBytesAfter += after;
    diffs.push({
      id: d.id,
      category: d.category,
      title: oldTitle,
      titleChanged,
      descChanged,
      contentChanged,
      byteDelta: after - before,
    });
  }

  console.log(`📊 Resumo:`);
  console.log(`   Documents alterados: ${diffs.length}`);
  console.log(`   Total bytes: ${totalBytesBefore} → ${totalBytesAfter} (${totalBytesAfter - totalBytesBefore})`);
  console.log(`   Documents com mojibake (NÃO consertado por backfill): ${mojibakeDocs.length}`);

  // Por categoria
  const byCategory = new Map<string, number>();
  for (const d of diffs) byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + 1);
  console.log(`\nMudanças por categoria:`);
  for (const [cat, count] of byCategory) console.log(`   ${cat.padEnd(25)} ${count}`);

  // Top 10 mojibake docs
  if (mojibakeDocs.length > 0) {
    console.log(`\n⚠️  Documents com U+FFFD (precisam re-fetch — não consertados aqui):`);
    const top = mojibakeDocs.sort((a, b) => b.fffdCount - a.fffdCount).slice(0, 10);
    for (const m of top) {
      console.log(`   [${m.category.padEnd(15)}] ${m.fffdCount}× — ${m.title.slice(0, 60)}`);
    }
    if (mojibakeDocs.length > 10) console.log(`   ... +${mojibakeDocs.length - 10} outros`);
  }

  if (!apply) {
    console.log(`\n🔒 dry-run. Use --apply pra gravar.`);
    await prisma.$disconnect();
    return;
  }

  if (diffs.length === 0) {
    console.log(`\n✅ Sem mudanças.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n💾 Aplicando ${diffs.length} updates...`);
  let written = 0;
  for (const d of diffs) {
    const doc = docs.find((x) => x.id === d.id)!;
    const data: { title?: string; description?: string; content?: string } = {};
    if (d.titleChanged) data.title = normalizeScrapedText(doc.title || '');
    if (d.descChanged) data.description = normalizeScrapedText(doc.description || '');
    if (d.contentChanged) data.content = normalizeScrapedText(doc.content || '');
    await prisma.document.update({ where: { id: d.id }, data });
    written++;
    if (written % 50 === 0) console.log(`   ${written}/${diffs.length}...`);
  }
  console.log(`✅ ${written} updates aplicados.`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
