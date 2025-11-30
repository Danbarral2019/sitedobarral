require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.leiArticle.findMany({
    orderBy: { numero: 'asc' },
    select: { numero: true, titulo: true, capituloCompleto: true, capitulo: true, secao: true }
  });

  // Agrupar por titulo
  const byTitulo = {};
  for (const art of articles) {
    const key = art.titulo || 'SEM TITULO';
    if (!byTitulo[key]) byTitulo[key] = [];
    byTitulo[key].push(art.numero);
  }

  console.log('TITULOS encontrados:\n');
  for (const [titulo, arts] of Object.entries(byTitulo)) {
    console.log(titulo);
    console.log('   Artigos: ' + arts.slice(0,10).join(', ') + (arts.length > 10 ? '... (' + arts.length + ' total)' : ''));
    console.log('');
  }

  // Mostrar alguns exemplos completos
  console.log('\n--- EXEMPLOS DE ARTIGOS ---\n');
  const samples = ['1', '5', '18', '72', '79', '137', '174'];
  for (const num of samples) {
    const art = articles.find(a => a.numero === num);
    if (art) {
      console.log('Art. ' + num + ':');
      console.log('   titulo: ' + art.titulo);
      console.log('   capituloCompleto: ' + art.capituloCompleto);
      console.log('   capitulo: ' + art.capitulo);
      console.log('   secao: ' + (art.secao || '(vazio)'));
      console.log('');
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
