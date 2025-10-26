// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Testa o sistema de documentos comuns
 * Simula a query da API batch-data para verificar que ONs comuns
 * aparecem em todos os cursos
 */
async function testCommonDocuments() {
  try {
    console.log('🧪 Testando sistema de documentos comuns...\n');

    // Simular query da API para um curso específico
    const testCourseIds = ['1', '2', '3'];

    for (const courseId of testCourseIds) {
      console.log(`\n📊 Testando Curso ${courseId}:`);

      // Query que a API usa
      const documents = await prisma.document.findMany({
        where: {
          OR: [
            { courseId: courseId },      // Específicos do curso
            { isCommon: true },          // Comuns a todos
          ],
        },
        select: {
          id: true,
          title: true,
          category: true,
          courseId: true,
          isCommon: true,
        },
      });

      // Contar por categoria
      const byCat = {};
      documents.forEach(doc => {
        byCat[doc.category] = (byCat[doc.category] || 0) + 1;
      });

      // Contar comuns vs específicos
      const common = documents.filter(d => d.isCommon);
      const specific = documents.filter(d => !d.isCommon);

      console.log(`   Total de documentos: ${documents.length}`);
      console.log(`   Documentos comuns: ${common.length}`);
      console.log(`   Documentos específicos: ${specific.length}`);
      console.log(`   Por categoria:`, byCat);

      // Verificar ONs
      const ons = documents.filter(d => d.category === 'orientacao-normativa');
      console.log(`   ONs encontradas: ${ons.length}`);

      if (ons.length > 0) {
        const commonONs = ons.filter(o => o.isCommon);
        const specificONs = ons.filter(o => !o.isCommon);
        console.log(`     - ONs comuns: ${commonONs.length}`);
        console.log(`     - ONs específicas: ${specificONs.length}`);

        // Mostrar exemplos
        console.log(`   Exemplos de ONs:`);
        ons.slice(0, 3).forEach(on => {
          const type = on.isCommon ? 'COMUM' : `CURSO ${on.courseId}`;
          console.log(`     - [${type}] ${on.title.substring(0, 60)}...`);
        });
      }
    }

    // Verificar que todos os cursos têm o mesmo número de ONs comuns
    console.log(`\n🔍 Verificando consistência entre cursos...`);

    const results = [];
    for (let i = 1; i <= 10; i++) {
      const courseId = String(i);
      const docs = await prisma.document.findMany({
        where: {
          OR: [
            { courseId: courseId },
            { isCommon: true },
          ],
        },
      });

      const ons = docs.filter(d => d.category === 'orientacao-normativa');
      results.push({ courseId, totalDocs: docs.length, ons: ons.length });
    }

    console.log('\n📊 Documentos por curso:');
    results.forEach(r => {
      console.log(`   Curso ${r.courseId}: ${r.totalDocs} docs (${r.ons} ONs)`);
    });

    // Verificar se todos têm o mesmo número de ONs
    const onCounts = results.map(r => r.ons);
    const allSame = onCounts.every(count => count === onCounts[0]);

    if (allSame) {
      console.log(`\n✅ PERFEITO! Todos os cursos têm ${onCounts[0]} ONs (sistema de documentos comuns funcionando!)`);
    } else {
      console.log(`\n⚠️  INCONSISTÊNCIA! ONs variam entre cursos:`, onCounts);
    }

    // Resumo final
    console.log(`\n📊 RESUMO:`);
    const totalCommon = await prisma.document.count({ where: { isCommon: true } });
    const totalSpecific = await prisma.document.count({ where: { isCommon: false } });
    console.log(`   Documentos comuns no banco: ${totalCommon}`);
    console.log(`   Documentos específicos no banco: ${totalSpecific}`);
    console.log(`   Total no banco: ${totalCommon + totalSpecific}`);
    console.log(`   Eficiência: Com ${totalCommon} comuns, ${10} cursos acessam = ${totalCommon * 10} acessos totais`);
    console.log(`   Sem sistema comum, precisaria: ${totalCommon * 10} registros`);
    console.log(`   Economia: ${Math.round((1 - totalCommon / (totalCommon * 10)) * 100)}%`);

  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCommonDocuments();
