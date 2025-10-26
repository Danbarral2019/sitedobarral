// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Consolida ONs com múltiplas fundamentações em um único registro
 * - Mantém 1 registro por ON
 * - Adiciona URLs alternativas no campo alternativeUrls
 * - Remove links DOU quebrados (in.gov.br)
 * - Deleta registros duplicados
 */
async function consolidateMultipleFundamentacoes() {
  try {
    console.log('🔄 Consolidando ONs com múltiplas fundamentações...\n');

    // 1. Buscar todas as ONs
    const ons = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        url: true,
        alternativeUrls: true,
        isCommon: true,
      },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`📊 Total de ONs: ${ons.length}\n`);

    // 2. Agrupar por título base
    const byTitle = {};
    ons.forEach(on => {
      // Remover "(Fundamentação X)" e "- Redação original"
      const baseTitle = on.title
        .replace(/\s*\(Fundamentação\s+\d+\)\s*/gi, '')
        .replace(/\s*-\s*Redação original.*$/i, '')
        .replace(/\s*-\s*Redação de \d+.*$/i, '')
        .replace(/\s*-\s*redação de \d+.*$/i, '')
        .trim();

      if (!byTitle[baseTitle]) {
        byTitle[baseTitle] = [];
      }
      byTitle[baseTitle].push(on);
    });

    // 3. Filtrar apenas ONs com múltiplas entradas
    const multiple = Object.entries(byTitle)
      .filter(([_, docs]) => docs.length > 1);

    console.log(`📋 ONs com múltiplas entradas: ${multiple.length}`);

    if (multiple.length === 0) {
      console.log('✅ Nenhuma ON com múltiplas entradas!');
      return;
    }

    // 4. Processar cada grupo
    let consolidated = 0;
    let deleted = 0;
    let douLinksRemoved = 0;

    for (const [baseTitle, docs] of multiple) {
      console.log(`\n📄 Processando: ${baseTitle}`);
      console.log(`   Entradas encontradas: ${docs.length}`);

      // Separar URLs válidas (não-DOU) e DOU
      const validUrls = [];
      const douUrls = [];

      docs.forEach(doc => {
        if (doc.url.includes('in.gov.br') || doc.url.includes('imprensa.nacional')) {
          douUrls.push(doc.url);
          console.log(`   ❌ Link DOU quebrado: ${doc.url.substring(0, 60)}...`);
        } else {
          validUrls.push({ url: doc.url, id: doc.id });
          console.log(`   ✅ Link válido: ${doc.url.substring(0, 60)}...`);
        }
      });

      douLinksRemoved += douUrls.length;

      if (validUrls.length === 0) {
        console.log(`   ⚠️  ATENÇÃO: Nenhum link válido! Todas as fundamentações são DOU.`);
        console.log(`   Mantendo primeiro registro mas marcando URL como inválida.`);

        // Manter primeiro registro mas atualizar URL para indicar problema
        const firstDoc = docs[0];
        await prisma.document.update({
          where: { id: firstDoc.id },
          data: {
            url: 'LINK_INDISPONIVEL', // Marcar como indisponível
            alternativeUrls: JSON.stringify([]), // Sem alternativas
          }
        });

        // Deletar outros
        const toDelete = docs.slice(1).map(d => d.id);
        if (toDelete.length > 0) {
          await prisma.document.deleteMany({
            where: { id: { in: toDelete } }
          });
          deleted += toDelete.length;
        }

        continue;
      }

      // Escolher registro principal (primeiro com URL válida)
      const mainDoc = validUrls[0];
      const alternatives = validUrls.slice(1).map(v => v.url);

      console.log(`   👑 Registro principal: ${mainDoc.id}`);
      console.log(`   📎 URLs alternativas: ${alternatives.length}`);

      // Atualizar registro principal
      await prisma.document.update({
        where: { id: mainDoc.id },
        data: {
          title: baseTitle, // Remover "(Fundamentação X)" do título
          url: mainDoc.url,
          alternativeUrls: alternatives.length > 0 ? JSON.stringify(alternatives) : null,
        }
      });

      // Deletar registros duplicados
      const toDelete = docs
        .filter(d => d.id !== mainDoc.id)
        .map(d => d.id);

      if (toDelete.length > 0) {
        await prisma.document.deleteMany({
          where: { id: { in: toDelete } }
        });
        deleted += toDelete.length;
        console.log(`   🗑️  Deletados: ${toDelete.length} registros`);
      }

      consolidated++;
    }

    // 5. Verificar resultado
    const finalCount = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });

    const withAlternatives = await prisma.document.count({
      where: {
        category: 'orientacao-normativa',
        alternativeUrls: { not: null }
      }
    });

    console.log(`\n📊 RESULTADO:`);
    console.log(`   ONs consolidadas: ${consolidated}`);
    console.log(`   Registros deletados: ${deleted}`);
    console.log(`   Links DOU removidos: ${douLinksRemoved}`);
    console.log(`   Total de ONs após consolidação: ${finalCount}`);
    console.log(`   ONs com URLs alternativas: ${withAlternatives}`);

    console.log(`\n🎉 Consolidação concluída!`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

consolidateMultipleFundamentacoes();
