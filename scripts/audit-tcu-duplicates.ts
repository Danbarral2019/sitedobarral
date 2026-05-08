/**
 * Audita acórdãos TCU duplicados (race condition no sync-tcu-acordaos).
 * Identifica grupos por (acordaoNumero, acordaoAno, tcuOrgaoJulgador) com >1
 * e mostra qual seria mantido (mais aiBullets > mais dispositivos > mais recente).
 */
import { prisma } from '../lib/prisma';

interface DocRow {
  id: string;
  acordaoNumero: number | null;
  acordaoAno: number | null;
  tcuOrgaoJulgador: string | null;
  uploadedAt: Date;
  clippingExtract: { extractMethod: string; dispositivos: string | null; aiBullets: string | null } | null;
  _counts: { chunks: number; versions: number; lessonDocuments: number; favorites: number; highlights: number };
}

async function main() {
  const docs = await prisma.document.findMany({
    where: { category: 'acordao', acordaoNumero: { not: null }, acordaoAno: { not: null } },
    select: {
      id: true,
      acordaoNumero: true,
      acordaoAno: true,
      tcuOrgaoJulgador: true,
      uploadedAt: true,
      clippingExtract: { select: { extractMethod: true, dispositivos: true, aiBullets: true } },
      _count: { select: { chunks: true, versions: true, lessonDocuments: true, favorites: true, highlights: true } },
    },
  });

  const groups = new Map<string, DocRow[]>();
  for (const d of docs) {
    const key = `${d.acordaoNumero}/${d.acordaoAno}|${d.tcuOrgaoJulgador || ''}`;
    const arr = groups.get(key) || [];
    arr.push({
      id: d.id,
      acordaoNumero: d.acordaoNumero,
      acordaoAno: d.acordaoAno,
      tcuOrgaoJulgador: d.tcuOrgaoJulgador,
      uploadedAt: d.uploadedAt,
      clippingExtract: d.clippingExtract,
      _counts: d._count,
    });
    groups.set(key, arr);
  }

  let totalDups = 0;
  let totalKeep = 0;
  let totalDelete = 0;
  let totalChunksLost = 0;
  let totalVersionsLost = 0;
  let totalFavLost = 0;
  let totalLessonDocsLost = 0;
  let totalHighlightsLost = 0;
  const dupKeys: string[] = [];

  for (const [key, arr] of groups) {
    if (arr.length < 2) continue;
    totalDups++;
    dupKeys.push(key);
    const keeper = pickKeeper(arr);
    totalKeep++;
    for (const d of arr) {
      if (d.id === keeper.id) continue;
      totalDelete++;
      totalChunksLost += d._counts.chunks;
      totalVersionsLost += d._counts.versions;
      totalFavLost += d._counts.favorites;
      totalLessonDocsLost += d._counts.lessonDocuments;
      totalHighlightsLost += d._counts.highlights;
    }
    if (totalDups <= 5) {
      console.log(`\nGrupo ${key} (${arr.length} docs):`);
      for (const d of arr) {
        const isKeep = d.id === keeper.id;
        const dispLen = d.clippingExtract?.dispositivos?.length || 0;
        const ai = d.clippingExtract?.aiBullets ? 'AI' : 'no-AI';
        console.log(
          `  [${isKeep ? 'KEEP' : 'DEL '}] ${d.id} | ${ai} | dispLen=${dispLen} | uploaded=${d.uploadedAt.toISOString()} | chunks=${d._counts.chunks} fav=${d._counts.favorites} ver=${d._counts.versions} lessons=${d._counts.lessonDocuments} hl=${d._counts.highlights}`,
        );
      }
    }
  }

  console.log('\n=== RESUMO ===');
  console.log(`Acórdãos com duplicatas: ${totalDups}`);
  console.log(`Total docs a manter (keepers): ${totalKeep}`);
  console.log(`Total docs a deletar (perdedores): ${totalDelete}`);
  console.log(`Chunks que serão deletados (cascade): ${totalChunksLost}`);
  console.log(`DocumentVersions cascade: ${totalVersionsLost}`);
  console.log(`Favorites SetNull (preservados, fica órfão): ${totalFavLost}`);
  console.log(`LessonDocuments cascade (PERDA): ${totalLessonDocsLost}`);
  console.log(`TcuHighlights cascade (PERDA): ${totalHighlightsLost}`);

  // DailyClippingSends que referenciam esses IDs
  const losers: string[] = [];
  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    const keeper = pickKeeper(arr);
    for (const d of arr) if (d.id !== keeper.id) losers.push(d.id);
  }
  const sends = await prisma.dailyClippingSend.findMany({ select: { sentDate: true, acordaoIdsIncluded: true } });
  let sendsAffected = 0;
  for (const s of sends) {
    if (!s.acordaoIdsIncluded) continue;
    try {
      const ids = JSON.parse(s.acordaoIdsIncluded) as string[];
      if (Array.isArray(ids) && ids.some((id) => losers.includes(id))) sendsAffected++;
    } catch {}
  }
  console.log(`DailyClippingSends afetados (precisam remap): ${sendsAffected}`);
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
