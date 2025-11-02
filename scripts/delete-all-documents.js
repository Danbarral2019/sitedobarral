/**
 * Script para excluir TODOS os documentos do banco de dados
 * Use com cuidado! Esta ação é irreversível.
 */

// Carregar variáveis de ambiente do .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllDocuments() {
  try {
    console.log('🗑️  Iniciando exclusão de todos os documentos...\n');

    // Contar documentos antes
    const countBefore = await prisma.document.count();
    console.log(`📊 Total de documentos no banco: ${countBefore}`);

    if (countBefore === 0) {
      console.log('✅ Não há documentos para excluir.');
      return;
    }

    // Confirmar exclusão
    console.log('\n⚠️  ATENÇÃO: Esta ação irá EXCLUIR TODOS os documentos do banco de dados!');
    console.log('⚠️  Esta ação é IRREVERSÍVEL!\n');

    // Excluir todos os logs de acesso relacionados a documentos
    console.log('🗑️  Excluindo logs de acesso relacionados...');
    const deletedLogs = await prisma.accessLog.deleteMany({
      where: {
        documentId: {
          not: null
        }
      }
    });
    console.log(`✅ ${deletedLogs.count} logs de acesso excluídos`);

    // Excluir todos os favoritos
    console.log('🗑️  Excluindo favoritos relacionados...');
    const deletedFavorites = await prisma.favorite.deleteMany({});
    console.log(`✅ ${deletedFavorites.count} favoritos excluídos`);

    // Excluir análises de documentos (se houver)
    console.log('🗑️  Excluindo análises de documentos...');
    const deletedAnalyses = await prisma.documentAnalysis.deleteMany({});
    console.log(`✅ ${deletedAnalyses.count} análises excluídas`);

    // Excluir todos os documentos
    console.log('🗑️  Excluindo todos os documentos...');
    const deletedDocuments = await prisma.document.deleteMany({});
    console.log(`✅ ${deletedDocuments.count} documentos excluídos`);

    // Contar documentos depois
    const countAfter = await prisma.document.count();
    console.log(`\n📊 Total de documentos restantes: ${countAfter}`);

    console.log('\n✅ Exclusão concluída com sucesso!');
    console.log('\n💡 Agora você pode adicionar documentos reais através de:');
    console.log('   - /admin/documentos (upload individual)');
    console.log('   - /admin/importar (importação em massa via Excel)');
    console.log('   - /admin/tcu-import (importação de documentos TCU)');

  } catch (error) {
    console.error('❌ Erro ao excluir documentos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
deleteAllDocuments()
  .then(() => {
    console.log('\n🎉 Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
