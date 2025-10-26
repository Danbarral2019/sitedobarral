// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Corrige links DOU quebrados
 * Mantém os documentos mas marca URL como indisponível
 */
async function fixDOULinks() {
  try {
    console.log('🔧 Corrigindo links DOU quebrados...\n');

    // Buscar documentos com links DOU
    const douDocs = await prisma.document.findMany({
      where: {
        OR: [
          { url: { contains: 'in.gov.br' } },
          { url: { contains: 'imprensa.nacional' } },
        ]
      },
      select: {
        id: true,
        title: true,
        url: true,
        description: true,
        category: true,
      }
    });

    console.log(`📊 Documentos com links DOU: ${douDocs.length}\n`);

    if (douDocs.length === 0) {
      console.log('✅ Nenhum link DOU encontrado!');
      return;
    }

    console.log('📋 Documentos que serão atualizados:\n');
    douDocs.forEach((doc, idx) => {
      console.log(`${idx + 1}. ${doc.title}`);
      console.log(`   Categoria: ${doc.category}`);
      console.log(`   URL atual: ${doc.url.substring(0, 80)}...\n`);
    });

    console.log(`⚠️  ATENÇÃO: Esses documentos terão a URL marcada como "Link indisponível"`);
    console.log(`    Os documentos serão MANTIDOS no sistema (título e descrição preservados)\n`);

    // Atualizar documentos
    console.log('🔄 Atualizando documentos...');

    let updated = 0;
    for (const doc of douDocs) {
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          url: '#', // Link vazio/placeholder
          description: (doc.description || '') + '\n\n⚠️ Nota: O link de fundamentação original não está mais disponível. Este documento foi mantido apenas para referência do título e enunciado da Orientação Normativa.'
        }
      });
      updated++;
      console.log(`   ✅ Atualizado: ${doc.title.substring(0, 60)}...`);
    }

    console.log(`\n✅ ${updated} documentos atualizados com sucesso!`);

    // Verificar resultado
    const remainingDOU = await prisma.document.count({
      where: {
        OR: [
          { url: { contains: 'in.gov.br' } },
          { url: { contains: 'imprensa.nacional' } },
        ]
      }
    });

    console.log(`\n📊 Links DOU restantes: ${remainingDOU}`);

    if (remainingDOU === 0) {
      console.log('🎉 Sucesso! Nenhum link DOU quebrado restante!');
    }

    // Contar ONs restantes
    const totalONs = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });

    const validONs = await prisma.document.count({
      where: {
        category: 'orientacao-normativa',
        url: { not: '#' }
      }
    });

    console.log(`\n📊 Total de ONs: ${totalONs}`);
    console.log(`   ONs com links válidos: ${validONs}`);
    console.log(`   ONs sem link (apenas referência): ${totalONs - validONs}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixDOULinks();
