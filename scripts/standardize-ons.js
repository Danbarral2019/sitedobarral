// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Padroniza ONs:
 * 1. Remove duplicatas (com data-tippreview ou formatação ruim)
 * 2. Padroniza títulos para "Orientação Normativa AGU nº XX/XXXX"
 */
async function standardizeONs() {
  try {
    console.log('🔧 Padronizando Orientações Normativas...\n');

    // Buscar todas as ONs
    const ons = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        url: true,
        description: true,
        alternativeUrls: true,
      }
    });

    console.log(`📊 Total de ONs: ${ons.length}\n`);

    // Identificar e remover duplicatas com formatação ruim
    const toDelete = [];
    const toUpdate = [];

    // Agrupar por número/ano
    const byNumber = {};
    ons.forEach(on => {
      // Extrair número e ano do título
      const match = on.title.match(/(\d{1,3})\/(\d{4})/);
      if (match) {
        const key = `${match[1]}/${match[2]}`;
        if (!byNumber[key]) {
          byNumber[key] = [];
        }
        byNumber[key].push(on);
      }
    });

    // Para cada grupo, escolher o melhor e deletar os ruins
    for (const [key, docs] of Object.entries(byNumber)) {
      if (docs.length > 1) {
        console.log(`\n📄 ON ${key}: ${docs.length} entradas`);

        // Ordenar: preferir os sem data-tippreview e com descrição limpa
        docs.sort((a, b) => {
          const aHasHTML = a.title.includes('data-tippreview');
          const bHasHTML = b.title.includes('data-tippreview');

          if (aHasHTML && !bHasHTML) return 1; // b é melhor
          if (!aHasHTML && bHasHTML) return -1; // a é melhor

          // Se ambos têm ou não têm HTML, preferir o mais simples
          return a.title.length - b.title.length;
        });

        const keep = docs[0];
        const remove = docs.slice(1);

        console.log(`   ✅ Manter: "${keep.title.substring(0, 60)}..."`);

        remove.forEach(doc => {
          console.log(`   ❌ Deletar: "${doc.title.substring(0, 60)}..."`);
          toDelete.push(doc.id);
        });
      }
    }

    // Deletar duplicatas
    if (toDelete.length > 0) {
      console.log(`\n🗑️  Deletando ${toDelete.length} duplicatas...`);
      await prisma.document.deleteMany({
        where: { id: { in: toDelete } }
      });
      console.log('   ✅ Duplicatas removidas!');
    }

    // Buscar ONs atualizadas
    const updatedONs = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
      }
    });

    console.log(`\n📝 Padronizando ${updatedONs.length} títulos...\n`);

    // Padronizar todos os títulos
    let standardized = 0;
    for (const on of updatedONs) {
      // Extrair número e ano
      const match = on.title.match(/(\d{1,3})\/(\d{4})/);
      if (match) {
        const numero = match[1];
        const ano = match[2];

        // Novo título padronizado
        const newTitle = `Orientação Normativa AGU nº ${numero}/${ano}`;

        if (on.title !== newTitle) {
          await prisma.document.update({
            where: { id: on.id },
            data: { title: newTitle }
          });

          console.log(`   ✅ ${on.title} → ${newTitle}`);
          standardized++;
        }
      }
    }

    console.log(`\n✅ ${standardized} títulos padronizados!`);

    // Resultado final
    const finalCount = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });

    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`   Total de ONs: ${finalCount}`);
    console.log(`   Duplicatas removidas: ${toDelete.length}`);
    console.log(`   Títulos padronizados: ${standardized}`);
    console.log(`\n🎉 Padronização concluída!`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

standardizeONs();
