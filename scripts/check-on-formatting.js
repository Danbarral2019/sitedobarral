// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Verifica formatação e duplicatas das ONs específicas
 */
async function checkONFormatting() {
  try {
    console.log('🔍 Verificando formatação das ONs...\n');

    // Buscar todas as ONs
    const ons = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        url: true,
        alternativeUrls: true,
        description: true,
      },
      orderBy: { title: 'asc' }
    });

    console.log(`📊 Total de ONs: ${ons.length}\n`);

    // ONs específicas para verificar
    const checkNumbers = ['23', '21', '18', '15', '12', '8', '6', '4', '1'];

    console.log('📋 Verificando ONs específicas: 23, 21, 18, 15, 12, 8, 6, 4, 1\n');

    for (const num of checkNumbers) {
      // Buscar todas as ONs com esse número
      const matches = ons.filter(on =>
        on.title.includes(`ON ${num}/`) ||
        on.title.includes(`ON ${num.padStart(2, '0')}/`) ||
        on.title.includes(`Orientação Normativa ${num}/`) ||
        on.title.match(new RegExp(`\\b${num}/\\d{4}\\b`))
      );

      if (matches.length > 0) {
        console.log(`\n📄 ON ${num}:`);
        console.log(`   Entradas encontradas: ${matches.length}`);

        matches.forEach((on, idx) => {
          console.log(`\n   ${idx + 1}. "${on.title}"`);
          console.log(`      ID: ${on.id}`);
          console.log(`      URL: ${on.url}`);
          if (on.alternativeUrls) {
            const alts = JSON.parse(on.alternativeUrls);
            console.log(`      URLs alternativas: ${alts.length}`);
          }
          console.log(`      Descrição (primeiras 80 chars): ${(on.description || '').substring(0, 80)}...`);
        });

        // Verificar se são duplicatas
        if (matches.length > 1) {
          console.log(`\n   ⚠️  POSSÍVEL DUPLICATA!`);
        }
      }
    }

    // Análise de padrões de formatação
    console.log('\n\n📊 ANÁLISE DE FORMATAÇÃO:\n');

    const patterns = {
      'ON XX/XXXX': 0,
      'ON XXX/XXXX': 0,
      'Orientação Normativa': 0,
      'Outros': 0
    };

    ons.forEach(on => {
      if (on.title.match(/^ON \d{1,2}\/\d{4}/)) {
        patterns['ON XX/XXXX']++;
      } else if (on.title.match(/^ON \d{3}\/\d{4}/)) {
        patterns['ON XXX/XXXX']++;
      } else if (on.title.startsWith('Orientação Normativa')) {
        patterns['Orientação Normativa']++;
      } else {
        patterns['Outros']++;
      }
    });

    console.log('Padrões de formatação:');
    Object.entries(patterns).forEach(([pattern, count]) => {
      console.log(`   ${pattern}: ${count} documentos`);
    });

    // Exemplos de formatação
    console.log('\n📄 Exemplos de diferentes formatações:\n');
    const examples = ons.slice(0, 10);
    examples.forEach((on, idx) => {
      console.log(`${idx + 1}. ${on.title}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkONFormatting();
