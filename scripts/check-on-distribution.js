// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDistribution() {
  try {
    console.log('📊 Verificando distribuição de ONs por curso...\n');

    // Buscar todas as ONs
    const docs = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        courseId: true,
      }
    });

    // Contar por curso
    const byCourse = {};
    docs.forEach(doc => {
      byCourse[doc.courseId] = (byCourse[doc.courseId] || 0) + 1;
    });

    console.log('📊 ONs por curso:');
    Object.entries(byCourse)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([curso, count]) => {
        console.log(`   Curso ${curso}: ${count} ONs`);
      });

    console.log(`\nTotal: ${docs.length} ONs`);

    // Verificar se há duplicatas DENTRO de cada curso
    console.log('\n🔍 Verificando duplicatas DENTRO de cada curso...');
    let hasDuplicates = false;

    for (const [courseId, count] of Object.entries(byCourse)) {
      const courseDocs = docs.filter(d => d.courseId === courseId);
      const titles = courseDocs.map(d => d.title);
      const uniqueTitles = new Set(titles);

      if (titles.length !== uniqueTitles.size) {
        console.log(`   ❌ Curso ${courseId}: ${titles.length} documentos, mas apenas ${uniqueTitles.size} títulos únicos`);
        hasDuplicates = true;

        // Mostrar exemplos de duplicatas
        const titleCounts = {};
        titles.forEach(t => {
          titleCounts[t] = (titleCounts[t] || 0) + 1;
        });
        const dups = Object.entries(titleCounts).filter(([_, count]) => count > 1);
        console.log(`      Exemplos de duplicatas: ${dups.slice(0, 3).map(([t, c]) => `${t.substring(0, 30)}... (${c}x)`).join(', ')}`);
      } else {
        console.log(`   ✅ Curso ${courseId}: ${uniqueTitles.size} títulos únicos (sem duplicatas)`);
      }
    }

    if (!hasDuplicates) {
      console.log('\n🎉 Perfeito! Cada ON aparece 1x por curso.');
    } else {
      console.log('\n⚠️  Ainda existem duplicatas dentro de alguns cursos.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDistribution();
