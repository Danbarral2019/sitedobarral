/**
 * Limpa acórdãos TCU duplicados (race condition no sync-tcu-acordaos).
 * Para cada grupo (acordaoNumero, acordaoAno, tcuOrgaoJulgador) com >1 docs:
 *   1. Escolhe keeper (aiBullets > mais dispositivos > mais recente)
 *   2. Remap TcuHighlight, AccessLog, Favorite, DailyClippingSend para o keeper
 *   3. Deleta perdedores (cascade cuida do resto)
 *
 * Use --dry-run para simular sem alterar.
 */
import { prisma } from '../lib/prisma';

interface DocRow {
  id: string;
  acordaoNumero: number | null;
  acordaoAno: number | null;
  tcuOrgaoJulgador: string | null;
  uploadedAt: Date;
  clippingExtract: { dispositivos: string | null; aiBullets: string | null } | null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? '[DRY RUN] Nenhuma alteração será feita' : '[REAL RUN] Aplicando alterações');

  const docs = await prisma.document.findMany({
    where: { category: 'acordao', acordaoNumero: { not: null }, acordaoAno: { not: null } },
    select: {
      id: true,
      acordaoNumero: true,
      acordaoAno: true,
      tcuOrgaoJulgador: true,
      uploadedAt: true,
      clippingExtract: { select: { dispositivos: true, aiBullets: true } },
    },
  });

  const groups = new Map<string, DocRow[]>();
  for (const d of docs) {
    const key = `${d.acordaoNumero}/${d.acordaoAno}|${d.tcuOrgaoJulgador || ''}`;
    const arr = groups.get(key) || [];
    arr.push(d);
    groups.set(key, arr);
  }

  const remaps: Array<{ from: string; to: string; group: string }> = [];
  for (const [key, arr] of groups) {
    if (arr.length < 2) continue;
    const keeper = pickKeeper(arr);
    for (const d of arr) {
      if (d.id !== keeper.id) remaps.push({ from: d.id, to: keeper.id, group: key });
    }
  }

  if (remaps.length === 0) {
    console.log('Nenhuma duplicata encontrada.');
    return;
  }
  console.log(`${remaps.length} documentos perdedores em ${new Set(remaps.map((r) => r.group)).size} grupos`);

  let highlightsRemapped = 0;
  let favoritesRemapped = 0;
  let accessLogsRemapped = 0;
  let sendsUpdated = 0;
  let docsDeleted = 0;
  const losers = remaps.map((r) => r.from);

  // 1. Remap TcuHighlight
  for (const r of remaps) {
    const result = dryRun
      ? { count: await prisma.tcuHighlight.count({ where: { documentId: r.from } }) }
      : await prisma.tcuHighlight.updateMany({ where: { documentId: r.from }, data: { documentId: r.to } });
    highlightsRemapped += result.count;
  }
  console.log(`TcuHighlights remapeados: ${highlightsRemapped}`);

  // 2. Remap Favorite (FK opcional, SetNull no schema — atualizamos para o keeper)
  for (const r of remaps) {
    const result = dryRun
      ? { count: await prisma.favorite.count({ where: { documentId: r.from } }) }
      : await prisma.favorite.updateMany({ where: { documentId: r.from }, data: { documentId: r.to } });
    favoritesRemapped += result.count;
  }
  console.log(`Favorites remapeados: ${favoritesRemapped}`);

  // 3. Remap AccessLog (sem FK, fica órfão se não atualizar)
  for (const r of remaps) {
    const result = dryRun
      ? { count: await prisma.accessLog.count({ where: { documentId: r.from } }) }
      : await prisma.accessLog.updateMany({ where: { documentId: r.from }, data: { documentId: r.to } });
    accessLogsRemapped += result.count;
  }
  console.log(`AccessLogs remapeados: ${accessLogsRemapped}`);

  // 4. Atualizar DailyClippingSend.acordaoIdsIncluded (JSON array de Document.id)
  const remapMap = new Map(remaps.map((r) => [r.from, r.to]));
  const sends = await prisma.dailyClippingSend.findMany({
    select: { id: true, acordaoIdsIncluded: true, acordaoCount: true },
  });
  for (const s of sends) {
    if (!s.acordaoIdsIncluded) continue;
    let ids: string[];
    try {
      const parsed = JSON.parse(s.acordaoIdsIncluded);
      if (!Array.isArray(parsed)) continue;
      ids = parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      continue;
    }
    const hasLoser = ids.some((id) => remapMap.has(id));
    if (!hasLoser) continue;
    const newIds = Array.from(new Set(ids.map((id) => remapMap.get(id) || id)));
    sendsUpdated++;
    if (!dryRun) {
      await prisma.dailyClippingSend.update({
        where: { id: s.id },
        data: { acordaoIdsIncluded: JSON.stringify(newIds), acordaoCount: newIds.length },
      });
    }
    console.log(`  send ${s.id}: ${ids.length} ids → ${newIds.length} (após dedup)`);
  }
  console.log(`DailyClippingSends atualizados: ${sendsUpdated}`);

  // 5. Deletar Document perdedores (cascade cuida de chunks, versions, metaTcu, clippingExtract, etc.)
  if (!dryRun) {
    const result = await prisma.document.deleteMany({ where: { id: { in: losers } } });
    docsDeleted = result.count;
  } else {
    docsDeleted = losers.length;
  }
  console.log(`Documents deletados: ${docsDeleted}`);

  console.log(dryRun ? '\n[DRY RUN] Nada foi alterado. Rode sem --dry-run para aplicar.' : '\n[OK] Limpeza concluída.');
}

function pickKeeper(arr: DocRow[]): DocRow {
  return arr.reduce((best, d) => {
    const bestHasAi = !!best.clippingExtract?.aiBullets;
    const dHasAi = !!d.clippingExtract?.aiBullets;
    if (dHasAi && !bestHasAi) return d;
    if (bestHasAi && !dHasAi) return best;
    const bestDisp = best.clippingExtract?.dispositivos?.length || 0;
    const dDisp = d.clippingExtract?.dispositivos?.length || 0;
    if (dDisp > bestDisp) return d;
    if (dDisp < bestDisp) return best;
    return d.uploadedAt > best.uploadedAt ? d : best;
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
