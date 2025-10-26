// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Migração de ONs para o sistema de documentos comuns
 *
 * ANTES: 1.310 ONs (131 títulos × 10 cursos = 1.310 registros)
 * DEPOIS: 131 ONs (isCommon=true, courseId=null)
 *
 * Economia: 92% de redução (de 1.310 para 131 registros)
 */
async function migrateONsToCommon() {
  try {
    console.log('🔄 Iniciando migração de ONs para documentos comuns...\n');

    // 1. Buscar todas as ONs
    console.log('📊 PASSO 1: Analisando ONs existentes...');
    const allONs = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        courseId: true,
        isCommon: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`   Total de ONs: ${allONs.length}`);

    // Verificar se já existem ONs comuns
    const existingCommon = allONs.filter(on => on.isCommon);
    if (existingCommon.length > 0) {
      console.log(`   ⚠️  ATENÇÃO: Já existem ${existingCommon.length} ONs marcadas como comuns!`);
      console.log('   A migração vai consolidar TODAS as ONs em documentos comuns.');
    }

    // 2. Identificar ONs únicas (por título)
    console.log('\n📊 PASSO 2: Identificando ONs únicas...');
    const titleToONs = new Map();
    allONs.forEach(on => {
      if (!titleToONs.has(on.title)) {
        titleToONs.set(on.title, []);
      }
      titleToONs.get(on.title).push(on);
    });

    console.log(`   Títulos únicos: ${titleToONs.size}`);

    // 3. Selecionar 1 ON por título (prefere Curso 1, senão a mais recente)
    console.log('\n📊 PASSO 3: Selecionando ONs a manter...');
    const toKeep = [];
    const toDelete = [];

    titleToONs.forEach((ons, title) => {
      // Ordenar: Curso 1 primeiro, depois por data mais recente
      ons.sort((a, b) => {
        if (a.courseId === '1' && b.courseId !== '1') return -1;
        if (a.courseId !== '1' && b.courseId === '1') return 1;
        return b.uploadedAt - a.uploadedAt;
      });

      const chosen = ons[0];
      toKeep.push(chosen.id);

      // Todas as outras são para deletar
      for (let i = 1; i < ons.length; i++) {
        toDelete.push(ons[i].id);
      }
    });

    console.log(`   ONs a manter e marcar como comuns: ${toKeep.length}`);
    console.log(`   ONs duplicadas a deletar: ${toDelete.length}`);

    // 4. Confirmar ação
    console.log('\n⚠️  ATENÇÃO: Esta operação vai:');
    console.log(`   1. Marcar ${toKeep.length} ONs como COMUNS (isCommon=true, courseId=null)`);
    console.log(`   2. Deletar ${toDelete.length} ONs duplicadas`);
    console.log(`   3. Reduzir banco de ${allONs.length} para ${toKeep.length} registros (-${toDelete.length} = ${Math.round(toDelete.length / allONs.length * 100)}% redução)\n`);

    if (toDelete.length === 0 && toKeep.length === 0) {
      console.log('✅ Nenhuma alteração necessária!');
      return;
    }

    // 5. Atualizar ONs escolhidas para comuns
    if (toKeep.length > 0) {
      console.log('🔄 PASSO 4: Marcando ONs como documentos comuns...');
      const updateResult = await prisma.document.updateMany({
        where: { id: { in: toKeep } },
        data: {
          isCommon: true,
          courseId: null, // NULL = disponível para todos os cursos
        }
      });
      console.log(`   ✅ ${updateResult.count} ONs marcadas como comuns`);
    }

    // 6. Deletar duplicatas
    if (toDelete.length > 0) {
      console.log('\n🗑️  PASSO 5: Deletando ONs duplicadas...');
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
      console.log(`   ✅ ${deletedCount} ONs duplicadas deletadas`);
    }

    // 7. Verificar resultado
    console.log('\n📊 PASSO 6: Verificando resultado final...');
    const finalCount = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });

    const commonCount = await prisma.document.count({
      where: {
        category: 'orientacao-normativa',
        isCommon: true
      }
    });

    const specificCount = await prisma.document.count({
      where: {
        category: 'orientacao-normativa',
        isCommon: false
      }
    });

    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`   Total de ONs: ${finalCount}`);
    console.log(`   ONs comuns (isCommon=true): ${commonCount}`);
    console.log(`   ONs específicas de curso: ${specificCount}`);
    console.log(`\n🎉 Migração concluída com sucesso!`);
    console.log(`   Redução: ${allONs.length} → ${finalCount} registros (${Math.round((allONs.length - finalCount) / allONs.length * 100)}% de economia)`);

    // 8. Verificar se ONs comuns aparecem em todos os cursos
    console.log(`\n🔍 Testando sistema de documentos comuns...`);
    console.log(`   Com ${commonCount} ONs comuns, cada curso deve ter acesso a todas elas.`);
    console.log(`   Use a API /api/area-restrita/batch-data para verificar.`);

  } catch (error) {
    console.error('\n❌ ERRO na migração:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

migrateONsToCommon();
