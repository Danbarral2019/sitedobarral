require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.leiArticle.findMany({
    orderBy: { numero: 'asc' },
    select: { numero: true, titulo: true, capituloCompleto: true, capitulo: true }
  });

  // Simular o que a API faz
  const hierarchy = {};

  articles.forEach((art) => {
    const titulo = art.titulo || 'Sem Titulo';
    const capituloKey = art.capitulo || 'Sem Capitulo';

    if (!hierarchy[titulo]) {
      hierarchy[titulo] = { titulo, capitulos: {} };
    }

    if (!hierarchy[titulo].capitulos[capituloKey]) {
      hierarchy[titulo].capitulos[capituloKey] = {
        capituloCompleto: art.capituloCompleto || capituloKey,
        count: 0
      };
    }

    hierarchy[titulo].capitulos[capituloKey].count++;
  });

  console.log('HIERARQUIA (como a API monta):\n');
  for (const [tituloKey, tituloData] of Object.entries(hierarchy)) {
    console.log('='.repeat(60));
    console.log('TITULO: ' + tituloKey);
    console.log('='.repeat(60));

    for (const [capKey, capData] of Object.entries(tituloData.capitulos)) {
      console.log('  CAPITULO KEY: ' + capKey);
      console.log('  capituloCompleto: ' + capData.capituloCompleto);
      console.log('  artigos: ' + capData.count);
      console.log('');
    }
  }

  // Mostrar exemplos de valores reais
  console.log('\n--- EXEMPLOS DE CAMPOS ---\n');
  const samples = ['1', '18', '79', '137', '174'];
  for (const num of samples) {
    const art = articles.find(a => a.numero === num);
    if (art) {
      console.log('Art. ' + num + ':');
      console.log('   titulo: "' + art.titulo + '"');
      console.log('   capitulo: "' + art.capitulo + '"');
      console.log('   capituloCompleto: "' + art.capituloCompleto + '"');
      console.log('');
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
