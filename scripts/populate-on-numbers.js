// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

/**
 * Popula os campos onNumber e onYear para todas as ONs existentes
 */
async function populateONNumbers() {
  // Prisma 7 requer driver adapter
  const { PrismaNeon } = await import('@prisma/adapter-neon');
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('🔢 Populando números das ONs...\n');

    // Buscar todas as ONs
    const ons = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        onNumber: true,
        onYear: true,
      }
    });

    console.log(`📊 Total de ONs: ${ons.length}\n`);

    let updated = 0;
    let skipped = 0;

    for (const on of ons) {
      // Extrair número e ano do título
      const match = on.title.match(/(?:nº\s*|ON\s+)(\d{1,3})\/(\d{4})/i);

      if (match) {
        const numero = parseInt(match[1], 10);
        const ano = parseInt(match[2], 10);

        // Só atualizar se ainda não tiver os valores
        if (on.onNumber !== numero || on.onYear !== ano) {
          await prisma.document.update({
            where: { id: on.id },
            data: {
              onNumber: numero,
              onYear: ano,
            }
          });

          console.log(`   ✅ ${on.title} → ON ${numero}/${ano}`);
          updated++;
        } else {
          skipped++;
        }
      } else {
        console.log(`   ⚠️  Não foi possível extrair número/ano: ${on.title}`);
      }
    }

    console.log(`\n📊 RESULTADO:`);
    console.log(`   ONs atualizadas: ${updated}`);
    console.log(`   ONs já corretas: ${skipped}`);
    console.log(`\n✅ População concluída!`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

populateONNumbers();
