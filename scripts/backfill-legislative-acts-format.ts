/**
 * Backfill: aplica normalizeScrapedText em ementa + content de todos os
 * LegislativeAct existentes.
 *
 * Idempotente — rodar 2× produz o mesmo resultado.
 *
 * Modos:
 *   dry-run (default):  mostra resumo + sample dos diffs, NÃO escreve.
 *   --apply:            grava no banco.
 *   --id=<uuid>:        roda só num ato específico.
 *   --type=<lei|...>:   filtra por type.
 *   --diff-bytes=N:     mostra full diff só pra atos com mudança >= N bytes (default 100).
 */
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';
import { CacheInvalidation } from '../lib/cache/redis-client';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

interface Diff {
  fullNumber: string;
  id: string;
  ementaChanged: boolean;
  contentChanged: boolean;
  ementaDelta: number;
  contentDelta: number;
  /** primeiros chars onde difere (sample para inspeção) */
  ementaSample?: { before: string; after: string };
  contentSample?: { before: string; after: string };
}

function firstDiff(a: string, b: string): { idx: number; before: string; after: string } | null {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      const start = Math.max(0, i - 30);
      return {
        idx: i,
        before: a.slice(start, Math.min(a.length, i + 60)),
        after: b.slice(start, Math.min(b.length, i + 60)),
      };
    }
  }
  if (a.length !== b.length) {
    const i = len;
    return {
      idx: i,
      before: a.slice(Math.max(0, i - 30), i + 60),
      after: b.slice(Math.max(0, i - 30), i + 60),
    };
  }
  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const onlyId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];
  const onlyType = process.argv.find((a) => a.startsWith('--type='))?.split('=')[1];
  const diffBytesArg = process.argv.find((a) => a.startsWith('--diff-bytes='))?.split('=')[1];
  const diffBytesThreshold = diffBytesArg ? parseInt(diffBytesArg, 10) : 100;

  const where: { id?: string; type?: string } = {};
  if (onlyId) where.id = onlyId;
  if (onlyType) where.type = onlyType;

  const acts = await prisma.legislativeAct.findMany({
    where,
    select: { id: true, type: true, fullNumber: true, ementa: true, content: true },
    orderBy: [{ type: 'asc' }, { year: 'desc' }],
  });

  console.log(`📋 ${acts.length} atos${apply ? ' (modo APPLY)' : ' (dry-run)'}\n`);

  const diffs: Diff[] = [];
  let cleanCount = 0;

  for (const a of acts) {
    const newEmenta = normalizeScrapedText(a.ementa);
    const newContent = a.content ? normalizeScrapedText(a.content) : a.content;

    const ementaChanged = newEmenta !== a.ementa;
    const contentChanged = newContent !== a.content;

    if (!ementaChanged && !contentChanged) {
      cleanCount++;
      continue;
    }

    const diff: Diff = {
      fullNumber: a.fullNumber,
      id: a.id,
      ementaChanged,
      contentChanged,
      ementaDelta: ementaChanged ? newEmenta.length - a.ementa.length : 0,
      contentDelta: contentChanged && a.content && newContent ? newContent.length - a.content.length : 0,
    };

    if (ementaChanged) {
      const fd = firstDiff(a.ementa, newEmenta);
      if (fd) diff.ementaSample = { before: fd.before, after: fd.after };
    }
    if (contentChanged && a.content && newContent) {
      const fd = firstDiff(a.content, newContent);
      if (fd) diff.contentSample = { before: fd.before, after: fd.after };
    }

    diffs.push(diff);
  }

  console.log(`✅ ${cleanCount} atos sem mudança`);
  console.log(`✏️  ${diffs.length} atos com mudança\n`);

  // Resumo agregado
  const ementaChanges = diffs.filter((d) => d.ementaChanged).length;
  const contentChanges = diffs.filter((d) => d.contentChanged).length;
  const totalEmentaDelta = diffs.reduce((s, d) => s + d.ementaDelta, 0);
  const totalContentDelta = diffs.reduce((s, d) => s + d.contentDelta, 0);

  console.log(`📊 Resumo de impacto:`);
  console.log(`   Ementas alteradas:  ${ementaChanges} (delta total: ${totalEmentaDelta} bytes)`);
  console.log(`   Contents alterados: ${contentChanges} (delta total: ${totalContentDelta} bytes)`);

  // Listar diffs grandes (sinaliza casos pra revisar manual)
  const bigDiffs = diffs.filter((d) => Math.abs(d.contentDelta) >= diffBytesThreshold || Math.abs(d.ementaDelta) >= 20);
  if (bigDiffs.length > 0) {
    console.log(`\n⚠️  ${bigDiffs.length} ato(s) com mudança grande (>=${diffBytesThreshold} bytes em content ou >=20 em ementa):`);
    for (const d of bigDiffs.slice(0, 30)) {
      console.log(`\n── ${d.fullNumber} (${d.id}) ──`);
      if (d.ementaChanged) {
        console.log(`   ementa: ${d.ementaDelta >= 0 ? '+' : ''}${d.ementaDelta} bytes`);
        if (d.ementaSample) {
          console.log(`     ANTES: ${JSON.stringify(d.ementaSample.before)}`);
          console.log(`     DEPOIS: ${JSON.stringify(d.ementaSample.after)}`);
        }
      }
      if (d.contentChanged) {
        console.log(`   content: ${d.contentDelta >= 0 ? '+' : ''}${d.contentDelta} bytes`);
        if (d.contentSample) {
          console.log(`     ANTES: ${JSON.stringify(d.contentSample.before)}`);
          console.log(`     DEPOIS: ${JSON.stringify(d.contentSample.after)}`);
        }
      }
    }
    if (bigDiffs.length > 30) console.log(`   ... e mais ${bigDiffs.length - 30}`);
  }

  if (!apply) {
    console.log(`\n🔒 dry-run: nada foi gravado. Use --apply para aplicar.`);
    await prisma.$disconnect();
    return;
  }

  // APPLY
  console.log(`\n💾 Gravando ${diffs.length} updates...`);
  let written = 0;
  for (const d of diffs) {
    const a = acts.find((x) => x.id === d.id)!;
    const updateData: { ementa?: string; content?: string; contentHash?: string } = {};
    if (d.ementaChanged) updateData.ementa = normalizeScrapedText(a.ementa);
    if (d.contentChanged && a.content) {
      const newContent = normalizeScrapedText(a.content);
      updateData.content = newContent;
      // Recompute hash para evitar false-change detection no próximo cron sync.
      updateData.contentHash = md5(newContent);
    }
    if (Object.keys(updateData).length === 0) continue;
    await prisma.legislativeAct.update({
      where: { id: d.id },
      data: updateData,
    });
    written++;
    if (written % 25 === 0) console.log(`   ${written}/${diffs.length}...`);
  }
  console.log(`✅ ${written} updates aplicados.`);

  // Invalidar cache Redis pra que as agregações (counts por tipo, ano,
  // issuer) reflitam imediatamente as mudanças. Sem isso, o site mostra
  // dados antigos por até 2h (CACHE_TTL.LEGISLATIVE_ACTS).
  if (written > 0) {
    console.log(`🔄 Invalidando cache...`);
    const removed = await CacheInvalidation.legislativeActs();
    console.log(`✅ Cache invalidado (${removed} keys).`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
