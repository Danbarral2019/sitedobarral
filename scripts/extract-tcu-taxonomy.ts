import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=== Extraindo taxonomia TCU dos 1.237 acórdãos classificados ===\n');

  const docs = await prisma.document.findMany({
    where: {
      category: 'acordao',
      tcuNumeroAcordao: { not: null },
      tcuArea: { not: null },
    },
    select: { tcuArea: true, tcuTema: true, tcuSubtema: true },
  });

  console.log(`Carregados ${docs.length} acórdãos com classificação\n`);

  // Estrutura: area -> tema -> Set<subtema>
  const taxonomy = new Map<string, Map<string, Set<string>>>();

  for (const d of docs) {
    const area = d.tcuArea!.trim();
    const tema = (d.tcuTema || '').trim();
    const subtema = (d.tcuSubtema || '').trim();

    if (!taxonomy.has(area)) taxonomy.set(area, new Map());
    const temasMap = taxonomy.get(area)!;
    if (!temasMap.has(tema)) temasMap.set(tema, new Set());
    if (subtema) temasMap.get(tema)!.add(subtema);
  }

  const areas = Array.from(taxonomy.keys()).sort();
  console.log(`Áreas únicas: ${areas.length}`);

  let totalTemas = 0;
  let totalSubtemas = 0;
  for (const [, temas] of taxonomy) {
    totalTemas += temas.size;
    for (const [, subs] of temas) totalSubtemas += subs.size;
  }
  console.log(`Temas únicos (cross-area): ${totalTemas}`);
  console.log(`Subtemas únicos: ${totalSubtemas}\n`);

  console.log('=== ÁREAS (com contagem de temas) ===');
  for (const area of areas) {
    const temasMap = taxonomy.get(area)!;
    const docsCount = docs.filter(d => d.tcuArea === area).length;
    console.log(`  ${area} (${temasMap.size} temas, ${docsCount} acórdãos)`);
  }

  // Salva taxonomia em JSON pra ser usada pelo classifier
  const outPath = path.join(process.cwd(), 'data', 'tcu-taxonomy.json');
  const taxonomyJson: Record<string, Record<string, string[]>> = {};
  for (const [area, temas] of taxonomy) {
    taxonomyJson[area] = {};
    for (const [tema, subs] of temas) {
      taxonomyJson[area][tema] = Array.from(subs).sort();
    }
  }
  fs.writeFileSync(outPath, JSON.stringify(taxonomyJson, null, 2), 'utf-8');
  console.log(`\nTaxonomia salva em: ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
