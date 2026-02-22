require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Verificar artigos específicos
  const artigos = ['79', '87', '174', '175', '1', '18', '75'];

  console.log('VERIFICANDO FORMATO DOS ARTIGOS:\n');
  console.log('='.repeat(70));

  for (const num of artigos) {
    const art = await prisma.leiArticle.findUnique({
      where: { numero: num },
      select: { numero: true, ementa: true }
    });

    if (art) {
      const primeiraLinha = art.ementa.split('\n')[0];
      const comecaComArt = primeiraLinha.toLowerCase().startsWith('art');

      console.log(`\nArt. ${num}:`);
      console.log(`  Começa com "Art.": ${comecaComArt ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`  Início: "${primeiraLinha.substring(0, 80)}..."`);
    }
  }

  // Contar quantos artigos NÃO começam com "Art."
  const todosArtigos = await prisma.leiArticle.findMany({
    select: { numero: true, ementa: true }
  });

  const semPrefixo = todosArtigos.filter(a => {
    const primeira = a.ementa.split('\n')[0].toLowerCase();
    return !primeira.startsWith('art');
  });

  console.log('\n' + '='.repeat(70));
  console.log(`\nRESUMO:`);
  console.log(`  Total de artigos: ${todosArtigos.length}`);
  console.log(`  Sem prefixo "Art.": ${semPrefixo.length}`);

  if (semPrefixo.length > 0) {
    console.log(`\n  Artigos sem prefixo:`);
    semPrefixo.forEach(a => {
      console.log(`    - Art. ${a.numero}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
