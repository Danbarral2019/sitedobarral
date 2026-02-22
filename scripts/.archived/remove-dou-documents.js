// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Remove documentos com links DOU quebrados (in.gov.br)
 * Esses links não funcionam e mostram erro da Imprensa Nacional
 */
async function removeDOUDocuments() {
  try {
    console.log('🗑️  Removendo documentos com links DOU quebrados...\n');

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
        category: true,
        isCommon: true,
      }
    });

    console.log(`📊 Documentos com links DOU encontrados: ${douDocs.length}\n`);

    if (douDocs.length === 0) {
      console.log('✅ Nenhum link DOU encontrado!');
      return;
    }

    // Mostrar o que será deletado
    console.log('📋 Documentos que serão removidos:\n');
    douDocs.forEach((doc, idx) => {
      console.log(`${idx + 1}. ${doc.title.substring(0, 60)}...`);
      console.log(`   Categoria: ${doc.category}`);
      console.log(`   Comum: ${doc.isCommon ? 'Sim' : 'Não'}`);
      console.log(`   URL: ${doc.url.substring(0, 80)}...\n`);
    });

    console.log(`⚠️  ATENÇÃO: ${douDocs.length} documentos serão DELETADOS permanentemente!`);
    console.log('    Esses links não funcionam (erro: "Jornal inválido ou não informado")\n');

    // Deletar documentos
    console.log('🗑️  Iniciando deleção...');
    const ids = douDocs.map(d => d.id);

    const result = await prisma.document.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    console.log(`✅ ${result.count} documentos deletados com sucesso!`);

    // Verificar resultado
    const remainingDOU = await prisma.document.count({
      where: {
        OR: [
          { url: { contains: 'in.gov.br' } },
          { url: { contains: 'imprensa.nacional' } },
        ]
      }
    });

    if (remainingDOU === 0) {
      console.log('\n🎉 Sucesso! Nenhum link DOU restante no banco.');
    } else {
      console.log(`\n⚠️  Ainda restam ${remainingDOU} documentos com links DOU.`);
    }

    // Contar ONs restantes
    const totalONs = await prisma.document.count({
      where: { category: 'orientacao-normativa' }
    });

    console.log(`\n📊 Total de ONs após limpeza: ${totalONs}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

removeDOUDocuments();
