import { prisma } from '../lib/prisma';

async function main() {
  console.log('=== Diagnóstico de acórdãos TCU em Document ===\n');

  const totalDocs = await prisma.document.count();
  console.log(`Total de Documents:                               ${totalDocs}`);

  const category = await prisma.document.count({ where: { category: 'acordao' } });
  console.log(`category='acordao':                               ${category}`);

  const withTcuNumero = await prisma.document.count({
    where: { tcuNumeroAcordao: { not: null } },
  });
  console.log(`tcuNumeroAcordao IS NOT NULL:                     ${withTcuNumero}`);

  const critRoute = await prisma.document.count({
    where: {
      category: 'acordao',
      tcuNumeroAcordao: { not: null },
    },
  });
  console.log(`category='acordao' AND tcuNumeroAcordao NOT NULL: ${critRoute}  ← critério atual da rota`);

  const withAcordaoNumero = await prisma.document.count({
    where: { acordaoNumero: { not: null } },
  });
  console.log(`acordaoNumero IS NOT NULL:                        ${withAcordaoNumero}`);

  const acordaoNotTcuNumero = await prisma.document.count({
    where: {
      category: 'acordao',
      acordaoNumero: { not: null },
      tcuNumeroAcordao: null,
    },
  });
  console.log(`category='acordao' AND acordaoNumero NOT NULL mas tcuNumeroAcordao NULL: ${acordaoNotTcuNumero}  ← acórdãos "órfãos"`);

  console.log('\n=== Amostra de acórdãos "órfãos" (category=acordao, acordaoNumero preenchido, sem tcuNumeroAcordao) ===');
  const orphans = await prisma.document.findMany({
    where: {
      category: 'acordao',
      acordaoNumero: { not: null },
      tcuNumeroAcordao: null,
    },
    select: {
      id: true,
      title: true,
      acordaoNumero: true,
      acordaoAno: true,
      tcuNumeroAcordao: true,
      tcuEnriquecimentoStatus: true,
      tcuEnriquecidoEm: true,
      issuerOrg: true,
      url: true,
    },
    take: 10,
  });
  for (const d of orphans) {
    console.log(`  - [${d.id.slice(0, 8)}] ${d.title?.slice(0, 70)} (ac ${d.acordaoNumero}/${d.acordaoAno}, enriq=${d.tcuEnriquecimentoStatus ?? 'null'}, issuer=${d.issuerOrg ?? 'null'})`);
  }

  console.log('\n=== Outras categorias com campos tcu* preenchidos ===');
  const otherCategories = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
    SELECT category, COUNT(*)::int as count
    FROM "Document"
    WHERE "tcuNumeroAcordao" IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
  `;
  for (const row of otherCategories) {
    console.log(`  ${row.category}: ${row.count}`);
  }

  console.log('\n=== Status de enriquecimento TCU ===');
  const enrichmentStatuses = await prisma.$queryRaw<Array<{ status: string | null; count: bigint }>>`
    SELECT "tcuEnriquecimentoStatus" as status, COUNT(*)::int as count
    FROM "Document"
    WHERE category = 'acordao'
    GROUP BY "tcuEnriquecimentoStatus"
    ORDER BY count DESC
  `;
  for (const row of enrichmentStatuses) {
    console.log(`  ${row.status ?? 'NULL'}: ${row.count}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
