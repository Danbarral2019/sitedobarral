/**
 * Script para adicionar prefixo "Art. X" aos artigos que não o possuem
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Corrigindo prefixo dos artigos...\n');

  // Buscar todos os artigos
  const artigos = await prisma.leiArticle.findMany({
    select: { numero: true, ementa: true }
  });

  let corrigidos = 0;

  for (const art of artigos) {
    const primeiraLinha = art.ementa.split('\n')[0].toLowerCase();

    // Se não começa com "art", adicionar prefixo
    if (!primeiraLinha.startsWith('art')) {
      // Formatar número do artigo (79 -> 79, 44-A -> 44-A)
      const prefixo = `Art. ${art.numero}. `;

      const novaEmenta = prefixo + art.ementa;

      await prisma.leiArticle.update({
        where: { numero: art.numero },
        data: { ementa: novaEmenta }
      });

      console.log(`✅ Art. ${art.numero} corrigido`);
      console.log(`   Antes: "${art.ementa.substring(0, 50)}..."`);
      console.log(`   Depois: "${novaEmenta.substring(0, 50)}..."`);
      console.log('');

      corrigidos++;
    }
  }

  console.log('='.repeat(50));
  console.log(`Resultado: ${corrigidos} artigos corrigidos`);
  console.log('='.repeat(50));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Erro:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
