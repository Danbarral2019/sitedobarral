// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Testa a ordenação numérica das ONs
 */
async function testNumericSorting() {
  try {
    console.log('🧪 Testando ordenação numérica das ONs...\n');

    // Buscar ONs com ordenação numérica
    const ons = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      orderBy: [
        { onNumber: 'desc' },
        { onYear: 'desc' },
        { title: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        onNumber: true,
        onYear: true,
      }
    });

    console.log(`📊 Total de ONs: ${ons.length}\n`);

    // Mostrar primeiras 15 ONs
    console.log('📋 Primeiras 15 ONs (ordem decrescente numérica):');
    ons.slice(0, 15).forEach((on, i) => {
      console.log(`${String(i + 1).padStart(2, ' ')}. ON ${on.onNumber}/${on.onYear} - ${on.title}`);
    });

    // Mostrar últimas 10 ONs
    console.log('\n📋 Últimas 10 ONs:');
    ons.slice(-10).forEach((on, i) => {
      const pos = ons.length - 9 + i;
      console.log(`${String(pos).padStart(2, ' ')}. ON ${on.onNumber}/${on.onYear} - ${on.title}`);
    });

    // Verificar se está realmente em ordem decrescente
    console.log('\n🔍 Verificando ordem...');
    let isCorrect = true;
    for (let i = 0; i < ons.length - 1; i++) {
      const current = ons[i];
      const next = ons[i + 1];

      // Comparar: current deve ser >= next
      if (current.onNumber < next.onNumber) {
        console.log(`   ❌ Erro: ON ${current.onNumber}/${current.onYear} antes de ON ${next.onNumber}/${next.onYear}`);
        isCorrect = false;
      } else if (current.onNumber === next.onNumber && current.onYear < next.onYear) {
        console.log(`   ❌ Erro: ON ${current.onNumber}/${current.onYear} antes de ON ${next.onNumber}/${next.onYear}`);
        isCorrect = false;
      }
    }

    if (isCorrect) {
      console.log('   ✅ Ordem numérica correta!');
    }

    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testNumericSorting();
