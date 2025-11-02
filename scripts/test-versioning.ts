/**
 * Script de Teste para Sistema de Versionamento
 *
 * Testa detecção de mudanças e criação de versões históricas
 */

import { prisma } from '@/lib/prisma';
import {
  detectChanges,
  saveDocumentVersion,
  findOrCreateWithVersioning,
  getDocumentHistory,
  getVersioningStats
} from '@/lib/agu-modules/versioning';

async function main() {
  console.log('🧪 Testando Sistema de Versionamento...\n');

  // ============================================================
  // TESTE 1: Criar documento novo
  // ============================================================
  console.log('📝 TESTE 1: Criar documento novo');

  const docData1 = {
    title: 'Orientação Normativa nº 99/2025 - TESTE',
    description: 'Versão inicial do documento de teste',
    type: 'link',
    url: 'https://example.com/on-99-2025',
    category: 'on',
    isPublic: false,
    onNumber: 99,
    onYear: 2025,
    tags: JSON.stringify(['licitação', 'teste'])
  };

  const result1 = await findOrCreateWithVersioning(
    { onNumber: 99, onYear: 2025 },
    docData1,
    'test-script'
  );

  console.log(`✅ Documento criado: ${result1.document.id}`);
  console.log(`   É novo? ${result1.isNew}`);
  console.log(`   Tem mudanças? ${result1.hasChanges}\n`);

  // ============================================================
  // TESTE 2: Atualizar com mudança pequena (minor)
  // ============================================================
  console.log('📝 TESTE 2: Atualizar com mudança pequena');

  const docData2 = {
    ...docData1,
    description: 'Descrição atualizada com pequena correção'
  };

  const result2 = await findOrCreateWithVersioning(
    { onNumber: 99, onYear: 2025 },
    docData2,
    'test-script'
  );

  console.log(`✅ Documento atualizado: ${result2.document.id}`);
  console.log(`   É novo? ${result2.isNew}`);
  console.log(`   Tem mudanças? ${result2.hasChanges}\n`);

  // ============================================================
  // TESTE 3: Atualizar com mudança grande (major)
  // ============================================================
  console.log('📝 TESTE 3: Atualizar com mudança grande (título)');

  const docData3 = {
    ...docData2,
    title: 'Orientação Normativa nº 99/2025 - REVISADA',
    url: 'https://example.com/on-99-2025-v2'
  };

  const result3 = await findOrCreateWithVersioning(
    { onNumber: 99, onYear: 2025 },
    docData3,
    'admin@teste.com'
  );

  console.log(`✅ Documento atualizado: ${result3.document.id}`);
  console.log(`   É novo? ${result3.isNew}`);
  console.log(`   Tem mudanças? ${result3.hasChanges}\n`);

  // ============================================================
  // TESTE 4: Tentar atualizar sem mudanças
  // ============================================================
  console.log('📝 TESTE 4: Tentar atualizar sem mudanças');

  const result4 = await findOrCreateWithVersioning(
    { onNumber: 99, onYear: 2025 },
    docData3, // Mesmos dados
    'test-script'
  );

  console.log(`✅ Documento verificado: ${result4.document.id}`);
  console.log(`   É novo? ${result4.isNew}`);
  console.log(`   Tem mudanças? ${result4.hasChanges}\n`);

  // ============================================================
  // TESTE 5: Ver histórico de versões
  // ============================================================
  console.log('📝 TESTE 5: Ver histórico de versões');

  const history = await getDocumentHistory(result1.document.id);

  console.log(`📚 Total de versões: ${history.length}`);
  for (const version of history) {
    console.log(`\n   Versão ${version.versionNumber}:`);
    console.log(`   - Tipo: ${version.changeType}`);
    console.log(`   - Mudanças: ${version.changesSummary}`);
    console.log(`   - Detectado por: ${version.detectedBy}`);
    console.log(`   - Data: ${version.detectedAt.toISOString()}`);
    console.log(`   - Atual? ${version.isCurrentVersion}`);
  }

  console.log('');

  // ============================================================
  // TESTE 6: Estatísticas gerais
  // ============================================================
  console.log('📝 TESTE 6: Estatísticas de versionamento');

  const stats = await getVersioningStats();

  console.log('📊 Estatísticas:');
  console.log(`   - Total de versões: ${stats.totalVersions}`);
  console.log(`   - Documentos com versões: ${stats.documentsWithVersions}`);
  console.log(`   - Documentos com múltiplas versões: ${stats.documentsWithMultipleVersions}`);
  console.log(`\n   Mudanças recentes:`);

  for (const change of stats.recentChanges.slice(0, 5)) {
    console.log(`   - [${change.changeType}] ${change.document.title}`);
    console.log(`     ${change.changesSummary}`);
  }

  console.log('');

  // ============================================================
  // TESTE 7: Detectar mudanças manualmente
  // ============================================================
  console.log('📝 TESTE 7: Detectar mudanças manualmente');

  const existingDoc = await prisma.document.findFirst({
    where: { onNumber: 99, onYear: 2025 }
  });

  if (existingDoc) {
    const newData = {
      title: 'Título completamente diferente',
      description: 'Nova descrição',
      tags: JSON.stringify(['novo', 'tags'])
    };

    const changeResult = await detectChanges(existingDoc, newData);

    console.log(`🔍 Resultado da detecção:`);
    console.log(`   - Tem mudanças? ${changeResult.hasChanges}`);
    console.log(`   - Tipo: ${changeResult.changeType}`);
    console.log(`   - Score de significância: ${changeResult.significanceScore}/100`);
    console.log(`   - Resumo: ${changeResult.changesSummary}`);
    console.log(`\n   Detalhes das mudanças:`);

    for (const change of changeResult.changeDetails) {
      console.log(`   - ${change.field} [${change.significance}]:`);
      console.log(`     Antes: "${change.oldValue.substring(0, 50)}..."`);
      console.log(`     Depois: "${change.newValue.substring(0, 50)}..."`);
    }
  }

  console.log('');

  // ============================================================
  // LIMPEZA: Remover documento de teste
  // ============================================================
  console.log('🧹 Limpando dados de teste...');

  await prisma.document.deleteMany({
    where: {
      onNumber: 99,
      onYear: 2025
    }
  });

  console.log('✅ Limpeza concluída!\n');

  console.log('✅ Todos os testes concluídos com sucesso!');
}

main()
  .catch((error) => {
    console.error('❌ Erro durante os testes:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
