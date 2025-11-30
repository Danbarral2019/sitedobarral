require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const art = await prisma.leiArticle.findUnique({
    where: { numero: '178' }
  });

  console.log('Art. 178 atual:');
  console.log(art.ementa.substring(0, 200));

  // Remover o prefixo duplicado
  let novaEmenta = art.ementa;

  // Remover "Art. 178. \n" do início se duplicado
  if (novaEmenta.startsWith('Art. 178. \nArt. 178.')) {
    novaEmenta = novaEmenta.replace('Art. 178. \nArt. 178.', 'Art. 178.');
  }

  // Remover quebras de linha iniciais
  novaEmenta = novaEmenta.trim();

  await prisma.leiArticle.update({
    where: { numero: '178' },
    data: { ementa: novaEmenta }
  });

  console.log('\nArt. 178 corrigido:');
  console.log(novaEmenta.substring(0, 200));

  await prisma.$disconnect();
}

main().catch(console.error);
