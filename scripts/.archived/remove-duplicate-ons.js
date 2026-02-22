// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeDuplicates() {
  try {
    console.log('🧹 Iniciando remoção de ONs duplicadas...\n');

    // Buscar todas as ONs ordenadas por data (mais recentes primeiro)
    const allONs = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        courseId: true,
        uploadedAt: true,
        url: true,
      },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`📊 Total de ONs no banco: ${allONs.length}`);

    // Criar mapa: título+courseId -> documento mais recente
    const uniqueMap = new Map();
    const toDelete = [];

    allONs.forEach(doc => {
      const key = `${doc.title}|||${doc.courseId}`;

      if (!uniqueMap.has(key)) {
        // Primeira ocorrência (mais recente) - manter
        uniqueMap.set(key, doc);
      } else {
        // Duplicata - marcar para deletar
        toDelete.push(doc.id);
      }
    });

    console.log(`\n✅ Documentos únicos a manter: ${uniqueMap.size}`);
    console.log(`❌ Duplicatas a remover: ${toDelete.length}`);

    if (toDelete.length === 0) {
      console.log('\n✅ Nenhuma duplicata encontrada!');
      return;
    }

    // Confirmar antes de deletar
    console.log(`\n⚠️  ATENÇÃO: Serão deletados ${toDelete.length} documentos duplicados.`);
    console.log('🔍 Primeiros 5 IDs a deletar:');
    toDelete.slice(0, 5).forEach(id => console.log(`   - ${id}`));

    // Deletar em lotes de 100
    console.log('\n🗑️  Iniciando deleção...');
    let deletedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      const result = await prisma.document.deleteMany({
        where: {
          id: { in: batch }
        }
      });
      deletedCount += result.count;
      console.log(`   Processado: ${deletedCount}/${toDelete.length}`);
    }

    console.log(`\n✅ Deleção concluída!`);
    console.log(`   Documentos removidos: ${deletedCount}`);
    console.log(`   Documentos únicos mantidos: ${uniqueMap.size}`);

    // Verificar resultado final
    const finalCount = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });

    console.log(`\n📊 Total de ONs após limpeza: ${finalCount}`);
    console.log(`🎉 Base de dados limpa com sucesso!`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

removeDuplicates();
