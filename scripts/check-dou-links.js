require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDouLinks() {
  // Busca documentos que contenham links do DOU (in.gov.br)
  const douDocs = await prisma.document.findMany({
    where: {
      category: 'orientacao-normativa',
      url: {
        contains: 'in.gov.br'
      }
    },
    select: {
      id: true,
      title: true,
      url: true,
      courseId: true
    },
    take: 20
  });

  const totalDou = await prisma.document.count({
    where: {
      category: 'orientacao-normativa',
      url: {
        contains: 'in.gov.br'
      }
    }
  });

  console.log(`\nTotal de documentos com links do DOU (in.gov.br): ${totalDou}`);

  if (douDocs.length > 0) {
    console.log('\nExemplos de documentos com links DOU:');
    douDocs.forEach(doc => {
      console.log(`\n- ${doc.title.substring(0, 60)}...`);
      console.log(`  Curso: ${doc.courseId}`);
      console.log(`  URL: ${doc.url}`);
    });
  } else {
    console.log('\n✓ Nenhum documento usando links do DOU (in.gov.br) - todos usando PDFs!');
  }

  // Estatísticas de tipos de URL
  const sapiensDocs = await prisma.document.count({
    where: {
      category: 'orientacao-normativa',
      url: { contains: 'sapiens.agu.gov.br' }
    }
  });

  const govbrDocs = await prisma.document.count({
    where: {
      category: 'orientacao-normativa',
      url: { contains: 'www.gov.br' }
    }
  });

  console.log('\nEstatísticas de URLs:');
  console.log(`  Sapiens (PDFs): ${sapiensDocs} documentos`);
  console.log(`  Gov.br (outros): ${govbrDocs} documentos`);
  console.log(`  DOU (in.gov.br): ${totalDou} documentos`);

  await prisma.$disconnect();
}

checkDouLinks();
