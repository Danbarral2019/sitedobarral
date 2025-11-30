require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Verificar atos normativos no banco
  const acts = await prisma.legislativeAct.findMany({
    orderBy: { fullNumber: 'asc' },
    select: {
      id: true,
      fullNumber: true,
      type: true,
      leiArticles: true,
      title: true
    }
  });

  console.log('ATOS NORMATIVOS NO BANCO:', acts.length);
  console.log('');

  for (const act of acts) {
    console.log('- ' + act.fullNumber);
    console.log('  Tipo: ' + act.type);
    console.log('  leiArticles: ' + (act.leiArticles || '(vazio)'));
    console.log('  Titulo: ' + (act.title || '').substring(0, 60) + '...');
    console.log('');
  }

  // Buscar especificamente a IN 81
  const in81 = await prisma.legislativeAct.findFirst({
    where: {
      OR: [
        { fullNumber: { contains: '81' } },
        { number: '81' }
      ]
    }
  });

  console.log('\n--- IN 81 ---');
  if (in81) {
    console.log('Encontrada:', in81.fullNumber);
    console.log('leiArticles:', in81.leiArticles);
  } else {
    console.log('NAO ENCONTRADA');
  }

  // Verificar também documentos com leiArticles
  const docsWithLei = await prisma.document.findMany({
    where: {
      leiArticles: { not: null }
    },
    select: {
      id: true,
      title: true,
      leiArticles: true
    },
    take: 10
  });

  console.log('\n--- DOCUMENTOS COM leiArticles (primeiros 10) ---');
  for (const doc of docsWithLei) {
    console.log('- ' + doc.title.substring(0, 50) + '...');
    console.log('  leiArticles: ' + doc.leiArticles);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
