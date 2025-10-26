// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyONStandardization() {
  try {
    console.log('🔍 Verificando padronização das ONs...\n');

    // Buscar todas as ONs em ordem decrescente
    const ons = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      orderBy: { title: 'desc' },
      select: {
        id: true,
        title: true,
        alternativeUrls: true,
      }
    });

    console.log(`📊 Total de ONs: ${ons.length}\n`);

    // Mostrar primeiras 10 ONs
    console.log('📋 Primeiras 10 ONs (ordem decrescente):');
    ons.slice(0, 10).forEach((on, i) => {
      const altCount = on.alternativeUrls ? JSON.parse(on.alternativeUrls).length : 0;
      const altText = altCount > 0 ? ` (+${altCount} URLs alternativas)` : '';
      console.log(`${i + 1}. ${on.title}${altText}`);
    });

    // Mostrar últimas 5 ONs
    console.log('\n📋 Últimas 5 ONs:');
    ons.slice(-5).forEach((on, i) => {
      const altCount = on.alternativeUrls ? JSON.parse(on.alternativeUrls).length : 0;
      const altText = altCount > 0 ? ` (+${altCount} URLs alternativas)` : '';
      console.log(`${i + 1}. ${on.title}${altText}`);
    });

    // Verificar formatação
    console.log('\n🔍 Verificando formatação dos títulos:\n');
    const standardPattern = /^Orientação Normativa AGU nº \d{1,3}\/\d{4}$/;
    const nonStandard = ons.filter(on => !standardPattern.test(on.title));

    if (nonStandard.length === 0) {
      console.log('✅ Todos os títulos estão no formato padrão!');
    } else {
      console.log(`⚠️  ${nonStandard.length} títulos com formato não padrão:`);
      nonStandard.forEach(on => {
        console.log(`   - ${on.title}`);
      });
    }

    // Contar ONs com URLs alternativas
    const withAlternatives = ons.filter(on => on.alternativeUrls).length;
    console.log(`\n📎 ONs com URLs alternativas: ${withAlternatives}`);

    console.log('\n✅ Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyONStandardization();
