const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script para tornar públicos todos os documentos indexados
 * Documentos com leiArticles são conteúdo oficial e devem ser públicos
 */
async function makeIndexedDocsPublic() {
  console.log('🔓 Tornando documentos indexados públicos...\n');

  // Contar documentos privados com indexação
  const privateIndexed = await prisma.document.count({
    where: {
      leiArticles: { not: null },
      isPublic: false
    }
  });

  console.log(`📊 Documentos privados indexados: ${privateIndexed}`);

  if (privateIndexed === 0) {
    console.log('\n✅ Todos os documentos indexados já são públicos!');
    return;
  }

  // Atualizar para público
  const result = await prisma.document.updateMany({
    where: {
      leiArticles: { not: null },
      isPublic: false
    },
    data: {
      isPublic: true
    }
  });

  console.log(`\n✅ ${result.count} documentos atualizados para público!`);

  // Verificar resultado
  const remaining = await prisma.document.count({
    where: {
      leiArticles: { not: null },
      isPublic: false
    }
  });

  console.log(`📊 Documentos privados restantes: ${remaining}`);

  await prisma.$disconnect();
}

makeIndexedDocsPublic().catch(console.error);
