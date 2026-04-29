/**
 * Faz dedup de LegislativeAct por (type, number, year) — agrupa registros que
 * representam o mesmo ato real-world mas têm fullNumber/issuer diferentes
 * (ex: "IN SEGES 190/2024" vs "IN SEGES/MGI 190/2024"). Transfere relações,
 * documents e enrolment do duplicado para o canônico, depois apaga o duplicado.
 *
 * Critério de canônico (em ordem de prioridade):
 *  1. Maior tamanho de content (mais texto = mais completo)
 *  2. Maior número de relações (sourceAct + targetAct)
 *  3. issuer mais recente/longo (ex: "SEGES/MGI" > "SEGES")
 *  4. publishDate mais recente
 *  5. id (estável, lexicográfico)
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/dedupe-legislative-acts.ts            # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/dedupe-legislative-acts.ts --apply
 */

import { prisma } from '../lib/prisma';

interface ActRow {
  id: string;
  fullNumber: string;
  type: string;
  number: string;
  year: number;
  issuer: string;
  publishDate: Date;
  content: string | null;
  relCount: number;
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`=== Dedup LegislativeAct ===`);
  console.log(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

  const groups = await prisma.$queryRaw<Array<{ type: string; number: string; year: number }>>`
    SELECT "type", "number", "year"
    FROM "LegislativeAct"
    GROUP BY "type", "number", "year"
    HAVING COUNT(*) > 1
  `;
  console.log(`Grupos com duplicatas: ${groups.length}`);

  let merged = 0;
  let relsRedirected = 0;
  let docsRedirected = 0;
  let actsDeleted = 0;
  let skipped = 0;

  for (const g of groups) {
    const acts = await prisma.legislativeAct.findMany({
      where: { type: g.type, number: g.number, year: g.year },
      include: {
        _count: { select: { relationsAsSource: true, relationsAsTarget: true } },
      },
    });
    if (acts.length < 2) continue;

    // Calcular relCount por ato
    const ranked: ActRow[] = acts.map((a) => ({
      id: a.id,
      fullNumber: a.fullNumber,
      type: a.type,
      number: a.number,
      year: a.year,
      issuer: a.issuer,
      publishDate: a.publishDate,
      content: a.content,
      relCount: a._count.relationsAsSource + a._count.relationsAsTarget,
    }));

    // Ordenar para escolher canônico
    ranked.sort((a, b) => {
      const ac = a.content?.length ?? 0;
      const bc = b.content?.length ?? 0;
      if (ac !== bc) return bc - ac;                       // 1. mais content
      if (a.relCount !== b.relCount) return b.relCount - a.relCount; // 2. mais relações
      if (a.issuer.length !== b.issuer.length) return b.issuer.length - a.issuer.length; // 3. issuer mais completo
      const ad = a.publishDate?.getTime() ?? 0;
      const bd = b.publishDate?.getTime() ?? 0;
      if (ad !== bd) return bd - ad;                       // 4. mais recente
      return a.id.localeCompare(b.id);                     // 5. estável
    });

    const canonical = ranked[0];
    const dups = ranked.slice(1);

    console.log(`\n[${g.type} ${g.number}/${g.year}] canônico: "${canonical.fullNumber}" (${canonical.id.slice(0, 8)}, content=${canonical.content?.length ?? 0}c, rels=${canonical.relCount})`);
    for (const d of dups) {
      console.log(`  → mesclar e apagar: "${d.fullNumber}" (${d.id.slice(0, 8)}, content=${d.content?.length ?? 0}c, rels=${d.relCount})`);
    }

    if (!apply) {
      skipped++;
      continue;
    }

    for (const dup of dups) {
      // Transferir relações em que dup é source. Tratar conflitos (mesma triple
      // já existir contra canonical) — se já existe, descarta a do dup.
      const sourceRels = await prisma.legislativeActRelation.findMany({
        where: { sourceActId: dup.id },
      });
      for (const rel of sourceRels) {
        // Auto-relação após transferência? Se canonical == targetActId, skip.
        if (rel.targetActId === canonical.id) {
          await prisma.legislativeActRelation.delete({ where: { id: rel.id } });
          continue;
        }
        const conflict = await prisma.legislativeActRelation.findUnique({
          where: {
            sourceActId_targetActId_relationType: {
              sourceActId: canonical.id,
              targetActId: rel.targetActId,
              relationType: rel.relationType,
            },
          },
        });
        if (conflict) {
          await prisma.legislativeActRelation.delete({ where: { id: rel.id } });
        } else {
          await prisma.legislativeActRelation.update({
            where: { id: rel.id },
            data: { sourceActId: canonical.id },
          });
          relsRedirected++;
        }
      }

      // Transferir relações em que dup é target.
      const targetRels = await prisma.legislativeActRelation.findMany({
        where: { targetActId: dup.id },
      });
      for (const rel of targetRels) {
        if (rel.sourceActId === canonical.id) {
          await prisma.legislativeActRelation.delete({ where: { id: rel.id } });
          continue;
        }
        const conflict = await prisma.legislativeActRelation.findUnique({
          where: {
            sourceActId_targetActId_relationType: {
              sourceActId: rel.sourceActId,
              targetActId: canonical.id,
              relationType: rel.relationType,
            },
          },
        });
        if (conflict) {
          await prisma.legislativeActRelation.delete({ where: { id: rel.id } });
        } else {
          await prisma.legislativeActRelation.update({
            where: { id: rel.id },
            data: { targetActId: canonical.id },
          });
          relsRedirected++;
        }
      }

      // Apagar o duplicado (cascade vai limpar chunks/embeddings via onDelete)
      await prisma.legislativeAct.delete({ where: { id: dup.id } });
      actsDeleted++;
    }
    merged++;
  }

  console.log(`\n=== Resumo ===`);
  console.log(`Grupos merged: ${merged}${apply ? '' : ' (dry-run)'}`);
  console.log(`Atos deletados: ${actsDeleted}`);
  console.log(`Relações redirecionadas: ${relsRedirected}`);
  if (!apply) console.log(`(dry-run — re-execute com --apply para aplicar)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
