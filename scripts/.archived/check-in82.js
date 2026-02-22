require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar IN 82 no LegislativeAct
  const in82 = await prisma.legislativeAct.findFirst({
    where: {
      OR: [
        { fullNumber: { contains: '82' } },
        { number: '82' }
      ],
      type: 'in'
    }
  });

  console.log('=== IN 82 NO MODELO LegislativeAct ===\n');
  if (in82) {
    console.log('ID:', in82.id);
    console.log('fullNumber:', in82.fullNumber);
    console.log('type:', in82.type);
    console.log('title:', in82.title);
    console.log('officialUrl:', in82.officialUrl);
    console.log('pdfUrl:', in82.pdfUrl);
    console.log('ementa:', in82.ementa?.substring(0, 100) + '...');
    console.log('leiArticles:', in82.leiArticles);
  } else {
    console.log('NAO ENCONTRADA no LegislativeAct');
  }

  // Verificar se existe no Document também
  const docIn82 = await prisma.document.findFirst({
    where: {
      OR: [
        { title: { contains: 'IN 82' } },
        { title: { contains: 'IN SEGES/MGI 82' } },
        { title: { contains: '82/2025' } }
      ]
    }
  });

  console.log('\n=== IN 82 NO MODELO Document ===\n');
  if (docIn82) {
    console.log('ID:', docIn82.id);
    console.log('title:', docIn82.title);
    console.log('url:', docIn82.url);
  } else {
    console.log('NAO ENCONTRADA no Document');
  }

  // Verificar a estrutura retornada pela API de artigos
  console.log('\n=== ESTRUTURA ESPERADA NA API ===\n');
  if (in82) {
    console.log('Formato que a API retorna para LegislativeAct:');
    console.log({
      id: in82.id,
      title: `${in82.fullNumber} - ${in82.title}`,
      isPublic: true,
      category: in82.type,
      type: 'legislativeAct'
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
