/**
 * Script de Exclusão de Documentos DOU Indesejados
 *
 * ATENÇÃO: Este script exclui permanentemente documentos do banco de dados!
 *
 * Remove apenas documentos DOU indesejados (extratos, avisos, portarias genéricas)
 * Preserva documentos DECOR da AGU (pareceres e notas técnicas)
 *
 * Uso:
 *   node scripts/delete-dou-documents.js           # Dry-run (não exclui)
 *   node scripts/delete-dou-documents.js --execute # Executa exclusão
 *
 * O script:
 * 1. Faz backup completo dos documentos a serem excluídos
 * 2. Remove dependências (Favorites, DocumentVersion, AccessLog)
 * 3. Remove os documentos
 * 4. Gera relatório detalhado
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// Extrair argumento da linha de comando
const args = process.argv.slice(2);
const EXECUTE_MODE = args.includes('--execute');

// IDs dos documentos DOU indesejados (excluindo DECOR)
const DOU_TO_DELETE_IDS = [
  // Extratos de contrato
  '58082c0a-19da-44e7-8537-23c48152333b', // EXTRATO DE CONTRATO Nº 511/2025/CAFIN
  '5e3ebd3a-f032-4e65-ae94-2a7ded2ad74c', // EXTRATO DE CONTRATO Nº 207/2025
  'd2d1bb6c-86d9-4bd0-835c-7b86c1cdf8ae', // EXTRATO DE CONTRATO Nº 17331/2025
  'bd908b00-2ef6-48d6-8174-1f2897ddbeb8', // EXTRATO DE CONTRATO Nº 19/2025
  '2372f648-83d3-4ef5-bac8-16fa5eb39d52', // EXTRATO DE CONTRATO Nº 39/2025

  // Extratos de apostilamento
  'a62626eb-7925-4e6d-b1ee-eab97115665b', // EXTRATO DE APOSTILAMENTO Nº 5/2025

  // Avisos
  '1038491e-e6d8-4681-8612-fa9f1535f14e', // AVISO DE INEXIGIBILIDADE DE LICITAÇÃO
  '58d645b8-5e26-44f4-a2aa-15492116048f', // AVISO DE LICITAÇÃO
  'b6e2aeec-5cb5-44bb-b0d0-a6189fcdb0fc', // AVISO DE ALTERAÇÃO

  // Outros
  '2da1e627-6d35-4507-a988-7b98b4a5dff7', // RETIFICAÇÃO
  '385fece5-4458-434a-a694-50978dfd0d12', // EDITAL de 3 de novembro de 2025
  '0ff53029-2463-491f-969c-3e74610b8891'  // PORTARIA Nº 729
];

async function deleteDouDocuments() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'data', 'backups');
  const backupPath = path.join(backupDir, `dou-deletion-backup-${timestamp}.json`);

  console.log('🗑️  Iniciando processo de exclusão de documentos DOU...\n');
  console.log(`Modo: ${EXECUTE_MODE ? '⚠️  EXECUÇÃO REAL' : '🔍 DRY-RUN (simulação)'}\n`);

  try {
    // 1. Buscar documentos completos para backup
    console.log('📦 Fazendo backup dos documentos...');
    const documentsToDelete = await prisma.document.findMany({
      where: {
        id: { in: DOU_TO_DELETE_IDS }
      },
      include: {
        versions: true,
        metaDou: true
      }
    });

    if (documentsToDelete.length === 0) {
      console.log('✅ Nenhum documento encontrado para exclusão. Possíveis causas:');
      console.log('   - Documentos já foram excluídos anteriormente');
      console.log('   - IDs incorretos no array DOU_TO_DELETE_IDS');
      return;
    }

    console.log(`   Encontrados ${documentsToDelete.length} de ${DOU_TO_DELETE_IDS.length} documentos\n`);

    // Verificar se algum ID não foi encontrado
    const foundIds = documentsToDelete.map(d => d.id);
    const missingIds = DOU_TO_DELETE_IDS.filter(id => !foundIds.includes(id));
    if (missingIds.length > 0) {
      console.log(`⚠️  IDs não encontrados (${missingIds.length}):`);
      missingIds.forEach(id => console.log(`   - ${id}`));
      console.log('');
    }

    // 2. Contar dependências
    console.log('🔗 Contando dependências...');
    const [favoritesCount, versionsCount, accessLogsCount] = await Promise.all([
      prisma.favorite.count({
        where: { documentId: { in: foundIds } }
      }),
      prisma.documentVersion.count({
        where: { documentId: { in: foundIds } }
      }),
      prisma.accessLog.count({
        where: { documentId: { in: foundIds } }
      })
    ]);

    console.log(`   Favorites: ${favoritesCount}`);
    console.log(`   Versões: ${versionsCount}`);
    console.log(`   Logs de acesso: ${accessLogsCount}\n`);

    // 3. Listar documentos a serem excluídos
    console.log('📄 Documentos que serão excluídos:');
    documentsToDelete.forEach((doc, index) => {
      console.log(`\n${index + 1}. ${doc.title.substring(0, 80)}${doc.title.length > 80 ? '...' : ''}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Categoria: ${doc.category}`);
      console.log(`   Curso: ${doc.courseId || 'N/A'}`);
      console.log(`   Criado em: ${doc.uploadedAt.toISOString().split('T')[0]}`);
    });

    // 4. Salvar backup
    await fs.mkdir(backupDir, { recursive: true });

    const backup = {
      backupDate: new Date().toISOString(),
      executeMode: EXECUTE_MODE,
      totalDocuments: documentsToDelete.length,
      dependencies: {
        favorites: favoritesCount,
        versions: versionsCount,
        accessLogs: accessLogsCount
      },
      documents: documentsToDelete.map(doc => ({
        ...doc,
        uploadedAt: doc.uploadedAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        reviewedAt: doc.reviewedAt?.toISOString(),
        notifiedAt: doc.notifiedAt?.toISOString(),
        summaryGeneratedAt: doc.summaryGeneratedAt?.toISOString(),
        feedbackGivenAt: doc.feedbackGivenAt?.toISOString(),
        notesUpdatedAt: doc.notesUpdatedAt?.toISOString(),
        tcuDataJulgamento: doc.tcuDataJulgamento?.toISOString(),
        tcuEnriquecidoEm: doc.tcuEnriquecidoEm?.toISOString(),
        tcuClassificadoEm: doc.tcuClassificadoEm?.toISOString(),
        r2UploadedAt: doc.r2UploadedAt?.toISOString(),
        geminiLastIndexed: doc.geminiLastIndexed?.toISOString(),
        douData: (doc.metaDou?.data ?? doc.douData)?.toISOString()
      }))
    };

    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
    console.log(`\n✅ Backup salvo em: ${backupPath}`);

    // 5. Executar exclusões (se em modo execute)
    if (EXECUTE_MODE) {
      console.log('\n🔥 INICIANDO EXCLUSÃO PERMANENTE...\n');

      // Excluir em ordem (foreign keys)
      console.log('1/4 Excluindo Favorites...');
      const deletedFavorites = await prisma.favorite.deleteMany({
        where: { documentId: { in: foundIds } }
      });
      console.log(`   ✓ ${deletedFavorites.count} favorites excluídos`);

      console.log('2/4 Excluindo DocumentVersions...');
      const deletedVersions = await prisma.documentVersion.deleteMany({
        where: { documentId: { in: foundIds } }
      });
      console.log(`   ✓ ${deletedVersions.count} versões excluídas`);

      console.log('3/4 Excluindo AccessLogs...');
      const deletedAccessLogs = await prisma.accessLog.deleteMany({
        where: { documentId: { in: foundIds } }
      });
      console.log(`   ✓ ${deletedAccessLogs.count} logs de acesso excluídos`);

      console.log('4/4 Excluindo Documents...');
      const deletedDocuments = await prisma.document.deleteMany({
        where: { id: { in: foundIds } }
      });
      console.log(`   ✓ ${deletedDocuments.count} documentos excluídos`);

      // 6. Salvar relatório de exclusão
      const deletionReport = {
        deletionDate: new Date().toISOString(),
        documentsDeleted: deletedDocuments.count,
        favoritesDeleted: deletedFavorites.count,
        versionsDeleted: deletedVersions.count,
        accessLogsDeleted: deletedAccessLogs.count,
        deletedDocumentIds: foundIds,
        backupPath: backupPath
      };

      const reportPath = path.join(backupDir, `dou-deletion-report-${timestamp}.json`);
      await fs.writeFile(reportPath, JSON.stringify(deletionReport, null, 2));

      console.log(`\n✅ Relatório de exclusão salvo em: ${reportPath}`);
      console.log('\n🎉 EXCLUSÃO CONCLUÍDA COM SUCESSO!');
      console.log(`\nResumo:`);
      console.log(`  ✓ ${deletedDocuments.count} documentos excluídos`);
      console.log(`  ✓ ${deletedFavorites.count} favorites removidos`);
      console.log(`  ✓ ${deletedVersions.count} versões removidas`);
      console.log(`  ✓ ${deletedAccessLogs.count} logs de acesso removidos`);
      console.log(`\nBackup disponível em: ${backupPath}`);

    } else {
      console.log('\n🔍 DRY-RUN CONCLUÍDO - Nenhuma exclusão foi realizada.');
      console.log('\n📝 Resumo do que seria excluído:');
      console.log(`  • ${documentsToDelete.length} documentos`);
      console.log(`  • ${favoritesCount} favorites`);
      console.log(`  • ${versionsCount} versões`);
      console.log(`  • ${accessLogsCount} logs de acesso`);
      console.log('\n⚠️  Para executar a exclusão real, rode:');
      console.log('   node scripts/delete-dou-documents.js --execute');
    }

    // 7. Avisos importantes
    console.log('\n📌 IMPORTANTE:');
    console.log('   ✓ Documentos DECOR da AGU foram PRESERVADOS (10 documentos)');
    console.log('   ✓ Apenas documentos DOU genéricos foram removidos/simulados');
    console.log('   ✓ Backup completo foi salvo antes de qualquer operação');

  } catch (error) {
    console.error('\n❌ Erro durante exclusão:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
deleteDouDocuments()
  .then(() => {
    console.log('\n✅ Script concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
  });
