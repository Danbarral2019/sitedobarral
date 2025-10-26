// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function consolidateONs() {
  try {
    console.log('🔄 Consolidando ONs para o Curso 1...\n');

    // Buscar todas as ONs
    const allONs = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        courseId: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`📊 Total de ONs no banco: ${allONs.length}`);

    // Criar mapa: título -> melhor documento (curso 1 se existir, senão o mais recente)
    const titleMap = new Map();
    const toDelete = [];
    const toUpdate = [];

    allONs.forEach(doc => {
      const existing = titleMap.get(doc.title);

      if (!existing) {
        // Primeira ocorrência
        titleMap.set(doc.title, doc);

        // Se não é curso 1, marcar para update
        if (doc.courseId !== '1') {
          toUpdate.push(doc.id);
        }
      } else {
        // Já existe um documento com este título
        if (doc.courseId === '1' && existing.courseId !== '1') {
          // Este é do curso 1 e o existente não é - preferir este
          toDelete.push(existing.id);
          titleMap.set(doc.title, doc);
        } else if (doc.courseId === '1' && existing.courseId === '1') {
          // Ambos são do curso 1 - manter o mais recente
          if (doc.uploadedAt < existing.uploadedAt) {
            toDelete.push(doc.id);
          } else {
            toDelete.push(existing.id);
            titleMap.set(doc.title, doc);
          }
        } else {
          // Manter o existente, deletar este
          toDelete.push(doc.id);
        }
      }
    });

    // Documentos únicos a manter
    const uniqueONs = Array.from(titleMap.values());

    // Atualizar courseId para '1' onde necessário
    const toUpdateFiltered = uniqueONs
      .filter(doc => doc.courseId !== '1')
      .map(doc => doc.id);

    console.log(`\n📊 ESTATÍSTICAS:`);
    console.log(`   Títulos únicos: ${uniqueONs.length}`);
    console.log(`   Documentos a deletar: ${toDelete.length}`);
    console.log(`   Documentos a atualizar para Curso 1: ${toUpdateFiltered.length}`);

    if (toDelete.length === 0 && toUpdateFiltered.length === 0) {
      console.log('\n✅ Nenhuma alteração necessária!');
      return;
    }

    // Executar updates
    if (toUpdateFiltered.length > 0) {
      console.log(`\n🔄 Atualizando ${toUpdateFiltered.length} documentos para Curso 1...`);
      await prisma.document.updateMany({
        where: { id: { in: toUpdateFiltered } },
        data: { courseId: '1' }
      });
      console.log('   ✅ Atualização concluída');
    }

    // Executar deletes
    if (toDelete.length > 0) {
      console.log(`\n🗑️  Deletando ${toDelete.length} duplicatas...`);
      let deletedCount = 0;
      const batchSize = 100;

      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const result = await prisma.document.deleteMany({
          where: { id: { in: batch } }
        });
        deletedCount += result.count;
        console.log(`   Processado: ${deletedCount}/${toDelete.length}`);
      }
      console.log('   ✅ Deleção concluída');
    }

    // Verificar resultado final
    const finalCount = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });

    const course1Count = await prisma.document.count({
      where: {
        category: 'orientacao-normativa',
        courseId: '1'
      }
    });

    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`   Total de ONs: ${finalCount}`);
    console.log(`   ONs no Curso 1: ${course1Count}`);
    console.log(`   ONs em outros cursos: ${finalCount - course1Count}`);

    if (finalCount === course1Count) {
      console.log(`\n🎉 Sucesso! Todas as ONs agora estão apenas no Curso 1!`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

consolidateONs();
