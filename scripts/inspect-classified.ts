import { prisma } from '../lib/prisma';

async function main() {
  const docs = await prisma.document.findMany({
    where: { aiClassification: { contains: 'licitacoesContratos' } },
    select: { title: true, aiClassification: true, leiArticles: true, leiArticlesArr: true },
    take: 3,
  });
  for (const d of docs) {
    console.log('---');
    console.log(d.title.slice(0, 90));
    const ai = JSON.parse(d.aiClassification!);
    console.log('  licitacoesContratos:', ai.licitacoesContratos);
    console.log('  vigencia (preserved):', ai.vigencia);
    console.log('  conuniId (preserved):', ai.conuniId);
    console.log('  cursosRelevantes:', ai.cursosRelevantes);
    console.log('  leiArticles:', ai.leiArticles);
    console.log('  subtemas:', ai.subtemas);
    console.log('  classifiedBy:', ai.classifiedBy);
    console.log('  doc.leiArticles field:', d.leiArticles);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
