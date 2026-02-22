// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    console.log('🔍 Verificando duplicatas de ONs...\n');

    // Buscar todas as ONs
    const docs = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        url: true,
        courseId: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`📊 Total de documentos ON: ${docs.length}\n`);

    // Contar duplicatas por título
    const titleCounts = {};
    const titleToDocs = {};

    docs.forEach(doc => {
      const key = doc.title;
      titleCounts[key] = (titleCounts[key] || 0) + 1;
      if (!titleToDocs[key]) {
        titleToDocs[key] = [];
      }
      titleToDocs[key].push(doc);
    });

    // Filtrar apenas duplicatas
    const duplicates = Object.entries(titleCounts)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    console.log('=== TOP 10 DUPLICATAS ===');
    duplicates.slice(0, 10).forEach(([title, count]) => {
      console.log(`${count}x - ${title.substring(0, 70)}`);
    });

    console.log(`\n📈 ESTATÍSTICAS:`);
    console.log(`   Total de títulos únicos: ${Object.keys(titleCounts).length}`);
    console.log(`   Títulos com duplicatas: ${duplicates.length}`);
    console.log(`   Total de documentos duplicados: ${docs.length - Object.keys(titleCounts).length}`);

    // Exemplo detalhado de uma duplicata
    if (duplicates.length > 0) {
      const [firstDupTitle, count] = duplicates[0];
      console.log(`\n=== EXEMPLO DE DUPLICATA ===`);
      console.log(`Título: ${firstDupTitle}`);
      console.log(`Quantidade: ${count} cópias`);
      console.log(`\nDetalhes de cada cópia:`);
      titleToDocs[firstDupTitle].forEach((doc, idx) => {
        console.log(`  ${idx + 1}. ID: ${doc.id} | Curso: ${doc.courseId} | URL: ${doc.url.substring(0, 50)}...`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
