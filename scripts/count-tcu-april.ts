import { prisma } from '../lib/prisma';

async function main() {
  const start = new Date('2026-04-01T00:00:00Z');
  const end = new Date('2026-05-01T00:00:00Z');

  console.log('=== Acórdãos TCU — abril/2026 ===\n');

  const catalogadosNoSite = await prisma.document.count({
    where: {
      category: 'acordao',
      tcuNumeroAcordao: { not: null },
      uploadedAt: { gte: start, lt: end },
    },
  });
  console.log(`Catalogados no site em abril (uploadedAt):      ${catalogadosNoSite}`);

  const julgadosEmAbril = await prisma.document.count({
    where: {
      category: 'acordao',
      tcuNumeroAcordao: { not: null },
      tcuDataJulgamento: { gte: start, lt: end },
    },
  });
  console.log(`Julgados pelo TCU em abril (tcuDataJulgamento): ${julgadosEmAbril}`);

  const enriquecidosEmAbril = await prisma.document.count({
    where: {
      category: 'acordao',
      tcuNumeroAcordao: { not: null },
      tcuEnriquecidoEm: { gte: start, lt: end },
    },
  });
  console.log(`Enriquecidos via scraper em abril:              ${enriquecidosEmAbril}`);

  const totalAcordaos = await prisma.document.count({
    where: { category: 'acordao', tcuNumeroAcordao: { not: null } },
  });
  console.log(`\nTotal de acórdãos TCU no site (todos os tempos): ${totalAcordaos}`);

  console.log('\n=== Por órgão julgador (julgados em abril) ===');
  const porOrgao = await prisma.$queryRaw<Array<{ orgao: string | null; count: bigint }>>`
    SELECT "tcuOrgaoJulgador" as orgao, COUNT(*)::int as count
    FROM "Document"
    WHERE category = 'acordao'
      AND "tcuNumeroAcordao" IS NOT NULL
      AND "tcuDataJulgamento" >= ${start}
      AND "tcuDataJulgamento" < ${end}
    GROUP BY "tcuOrgaoJulgador"
    ORDER BY count DESC
  `;
  for (const row of porOrgao) {
    console.log(`  ${row.orgao ?? 'NULL'}: ${row.count}`);
  }

  console.log('\n=== Top temas (julgados em abril) ===');
  const porTema = await prisma.$queryRaw<Array<{ area: string | null; tema: string | null; count: bigint }>>`
    SELECT "tcuArea" as area, "tcuTema" as tema, COUNT(*)::int as count
    FROM "Document"
    WHERE category = 'acordao'
      AND "tcuNumeroAcordao" IS NOT NULL
      AND "tcuDataJulgamento" >= ${start}
      AND "tcuDataJulgamento" < ${end}
    GROUP BY "tcuArea", "tcuTema"
    ORDER BY count DESC
    LIMIT 15
  `;
  for (const row of porTema) {
    console.log(`  [${row.area ?? '-'}] ${row.tema ?? '-'}: ${row.count}`);
  }

  console.log('\n=== Amostra de 10 acórdãos julgados em abril ===');
  const amostra = await prisma.document.findMany({
    where: {
      category: 'acordao',
      tcuNumeroAcordao: { not: null },
      tcuDataJulgamento: { gte: start, lt: end },
    },
    select: {
      tcuNumeroAcordao: true,
      tcuDataJulgamento: true,
      tcuRelator: true,
      tcuArea: true,
      tcuTema: true,
      title: true,
    },
    orderBy: { tcuDataJulgamento: 'desc' },
    take: 10,
  });
  for (const d of amostra) {
    const data = d.tcuDataJulgamento?.toISOString().slice(0, 10) ?? '-';
    console.log(`  ${data} | ${d.tcuNumeroAcordao} | rel: ${d.tcuRelator ?? '-'} | ${d.tcuArea ?? '-'} / ${d.tcuTema ?? '-'}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
