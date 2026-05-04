import { prisma } from '../lib/prisma';

async function main() {
  console.log('=== Diagnóstico de classificação editorial — acórdãos TCU ===\n');

  const total = await prisma.document.count({
    where: { category: 'acordao', tcuNumeroAcordao: { not: null } },
  });
  console.log(`Total de acórdãos TCU: ${total}\n`);

  const semArea = await prisma.document.count({
    where: { category: 'acordao', tcuNumeroAcordao: { not: null }, tcuArea: null },
  });
  const comArea = await prisma.document.count({
    where: { category: 'acordao', tcuNumeroAcordao: { not: null }, tcuArea: { not: null } },
  });
  console.log(`Sem tcuArea (taxonomia editorial): ${semArea}`);
  console.log(`Com tcuArea:                       ${comArea}`);

  const semClassificadoEm = await prisma.document.count({
    where: { category: 'acordao', tcuNumeroAcordao: { not: null }, tcuClassificadoEm: null },
  });
  const comClassificadoEm = await prisma.document.count({
    where: { category: 'acordao', tcuNumeroAcordao: { not: null }, tcuClassificadoEm: { not: null } },
  });
  console.log(`Sem tcuClassificadoEm (marker IA): ${semClassificadoEm}`);
  console.log(`Com tcuClassificadoEm:             ${comClassificadoEm}`);

  const semSummary = await prisma.document.count({
    where: { category: 'acordao', tcuNumeroAcordao: { not: null }, summary: null },
  });
  const comSummary = await prisma.document.count({
    where: { category: 'acordao', tcuNumeroAcordao: { not: null }, summary: { not: null } },
  });
  console.log(`Sem summary (resumo IA Gemini):    ${semSummary}`);
  console.log(`Com summary:                       ${comSummary}`);

  const semLei = await prisma.document.count({
    where: {
      category: 'acordao',
      tcuNumeroAcordao: { not: null },
      OR: [{ leiArticles: null }, { leiArticles: '' }, { leiArticles: '[]' }],
    },
  });
  console.log(`Sem leiArticles (artigos Lei):     ${semLei}`);

  console.log('\n=== Origem dos acórdãos sem tcuArea (por reviewedBy) ===');
  const porOrigem = await prisma.$queryRaw<Array<{ reviewedBy: string | null; count: bigint }>>`
    SELECT "reviewedBy", COUNT(*)::int as count
    FROM "Document"
    WHERE category = 'acordao'
      AND "tcuNumeroAcordao" IS NOT NULL
      AND "tcuArea" IS NULL
    GROUP BY "reviewedBy"
    ORDER BY count DESC
  `;
  for (const row of porOrigem) {
    console.log(`  ${row.reviewedBy ?? 'NULL'}: ${row.count}`);
  }

  console.log('\n=== Origem dos COM tcuArea (por reviewedBy) ===');
  const porOrigemCom = await prisma.$queryRaw<Array<{ reviewedBy: string | null; count: bigint }>>`
    SELECT "reviewedBy", COUNT(*)::int as count
    FROM "Document"
    WHERE category = 'acordao'
      AND "tcuNumeroAcordao" IS NOT NULL
      AND "tcuArea" IS NOT NULL
    GROUP BY "reviewedBy"
    ORDER BY count DESC
  `;
  for (const row of porOrigemCom) {
    console.log(`  ${row.reviewedBy ?? 'NULL'}: ${row.count}`);
  }

  console.log('\n=== TcuHighlight (marcações editoriais) ===');
  const totalHighlights = await prisma.tcuHighlight.count();
  console.log(`Total TcuHighlight: ${totalHighlights}`);

  console.log('\n=== Distribuição por ano de julgamento (sem tcuArea) ===');
  const porAno = await prisma.$queryRaw<Array<{ ano: number | null; count: bigint }>>`
    SELECT EXTRACT(YEAR FROM "tcuDataJulgamento")::int as ano, COUNT(*)::int as count
    FROM "Document"
    WHERE category = 'acordao'
      AND "tcuNumeroAcordao" IS NOT NULL
      AND "tcuArea" IS NULL
    GROUP BY ano
    ORDER BY ano DESC NULLS LAST
  `;
  for (const row of porAno) {
    console.log(`  ${row.ano ?? 'sem data'}: ${row.count}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
