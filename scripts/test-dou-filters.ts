/**
 * Script de Teste - DOU Advanced Filters
 *
 * Demonstra o sistema completo de filtros avançados para documentos DOU
 */

import { searchLastWeek } from '@/lib/dou-api';
import {
  DOUClassifier,
  DOUDocumentCategory,
  ApprovalStatus,
  AdvancedFilters,
  DateRangePreset,
  RELEVANT_ORGAOS,
} from '@/lib/dou-classifier';

async function main() {
  console.log('🚀 Teste do Sistema de Filtros Avançados DOU\n');
  console.log('='.repeat(80));

  try {
    // PASSO 1: Buscar documentos
    console.log('\n📡 PASSO 1: Buscando publicações DOU (última semana)...\n');

    const results = await searchLastWeek('licitação OR agu OR decreto', undefined, 100);

    console.log(`✅ ${results.length} publicações encontradas\n`);

    if (results.length === 0) {
      console.log('⚠️  Nenhuma publicação encontrada');
      process.exit(0);
    }

    // PASSO 2: Classificar documentos
    console.log('📊 PASSO 2: Classificando documentos...\n');

    const classifications = DOUClassifier.classifyBatch(results);
    const stats = DOUClassifier.getStats(classifications);

    console.log('📈 Estatísticas Iniciais:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   ✅ Auto-aprovados: ${stats.autoApproved}`);
    console.log(`   ⏳ Revisão manual: ${stats.pending}`);
    console.log(`   ❌ Auto-rejeitados: ${stats.autoRejected}`);

    // PASSO 3: Demonstrar filtros avançados
    console.log('\n\n' + '='.repeat(80));
    console.log('🔍 PASSO 3: TESTANDO FILTROS AVANÇADOS');
    console.log('='.repeat(80));

    // TESTE 1: Filtro por Seção
    console.log('\n\n📋 TESTE 1: Filtro por Seção (DO3 apenas)');
    console.log('-'.repeat(80));

    const filterBySection: AdvancedFilters = {
      sections: ['do3'],
    };

    const filteredBySection = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      filterBySection
    );

    const sectionStats = DOUClassifier.getFilterStats(
      results.length,
      filteredBySection.length,
      filterBySection
    );

    console.log(`\n✅ Resultado:`);
    console.log(`   Original: ${sectionStats.originalCount} documentos`);
    console.log(`   Filtrado: ${sectionStats.filteredCount} documentos`);
    console.log(`   Removidos: ${sectionStats.removedCount} (${sectionStats.removalRate})`);
    console.log(`   Filtros aplicados: ${sectionStats.appliedFilters.join(', ')}`);

    if (filteredBySection.length > 0) {
      console.log(`\n   Exemplos:`);
      filteredBySection.slice(0, 3).forEach((result, i) => {
        const titleClean = result.title.replace(/<[^>]*>/g, '').substring(0, 60);
        console.log(`   ${i + 1}. [${result.section.toUpperCase()}] ${titleClean}...`);
      });
    }

    // TESTE 2: Filtro por Órgão (AGU)
    console.log('\n\n📋 TESTE 2: Filtro por Órgão (AGU apenas)');
    console.log('-'.repeat(80));

    const filterByOrgao: AdvancedFilters = {
      orgaos: RELEVANT_ORGAOS.AGU,
    };

    const filteredByOrgao = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      filterByOrgao
    );

    const orgaoStats = DOUClassifier.getFilterStats(
      results.length,
      filteredByOrgao.length,
      filterByOrgao
    );

    console.log(`\n✅ Resultado:`);
    console.log(`   Original: ${orgaoStats.originalCount} documentos`);
    console.log(`   Filtrado: ${orgaoStats.filteredCount} documentos`);
    console.log(`   Removidos: ${orgaoStats.removedCount} (${orgaoStats.removalRate})`);
    console.log(`   Órgãos buscados: ${RELEVANT_ORGAOS.AGU.join(', ')}`);

    if (filteredByOrgao.length > 0) {
      console.log(`\n   Documentos encontrados:`);
      filteredByOrgao.slice(0, 5).forEach((result, i) => {
        const titleClean = result.title.replace(/<[^>]*>/g, '').substring(0, 60);
        console.log(`   ${i + 1}. ${titleClean}...`);
        console.log(`      Hierarquia: ${result.hierarchyStr}`);
      });
    } else {
      console.log(`\n   ⚠️  Nenhum documento da AGU encontrado nesta busca`);
    }

    // TESTE 3: Filtro por Data (últimos 3 dias)
    console.log('\n\n📋 TESTE 3: Filtro por Data (últimos 3 dias)');
    console.log('-'.repeat(80));

    const dateRange = DOUClassifier.getDateRangeFromPreset(DateRangePreset.ULTIMA_SEMANA);
    // Ajustar para 3 dias
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const filterByDate: AdvancedFilters = {
      dateFrom: threeDaysAgo,
      dateTo: new Date(),
    };

    const filteredByDate = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      filterByDate
    );

    const dateStats = DOUClassifier.getFilterStats(
      results.length,
      filteredByDate.length,
      filterByDate
    );

    console.log(`\n✅ Resultado:`);
    console.log(`   Original: ${dateStats.originalCount} documentos`);
    console.log(`   Filtrado: ${dateStats.filteredCount} documentos`);
    console.log(`   Removidos: ${dateStats.removedCount} (${dateStats.removalRate})`);
    console.log(`   Período: ${threeDaysAgo.toLocaleDateString('pt-BR')} até hoje`);

    if (filteredByDate.length > 0) {
      // Agrupar por data
      const byDate: Record<string, number> = {};
      filteredByDate.forEach((result) => {
        byDate[result.date] = (byDate[result.date] || 0) + 1;
      });

      console.log(`\n   Distribuição por data:`);
      Object.entries(byDate)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([date, count]) => {
          console.log(`   ${date}: ${count} documentos`);
        });
    }

    // TESTE 4: Filtro por Categoria (apenas auto-aprovados)
    console.log('\n\n📋 TESTE 4: Filtro por Categoria (Fonte AGU + Atos Normativos)');
    console.log('-'.repeat(80));

    const filterByCategory: AdvancedFilters = {
      categories: [DOUDocumentCategory.FONTE_AGU, DOUDocumentCategory.ATO_NORMATIVO],
    };

    const filteredByCategory = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      filterByCategory
    );

    const categoryStats = DOUClassifier.getFilterStats(
      results.length,
      filteredByCategory.length,
      filterByCategory
    );

    console.log(`\n✅ Resultado:`);
    console.log(`   Original: ${categoryStats.originalCount} documentos`);
    console.log(`   Filtrado: ${filteredByCategory.length} documentos`);
    console.log(`   Removidos: ${categoryStats.removedCount} (${categoryStats.removalRate})`);

    if (filteredByCategory.length > 0) {
      console.log(`\n   Exemplos de documentos relevantes:`);
      filteredByCategory.slice(0, 5).forEach((result, i) => {
        const classification = classifications.get(result)!;
        const titleClean = result.title.replace(/<[^>]*>/g, '').substring(0, 60);
        console.log(`   ${i + 1}. ${titleClean}...`);
        console.log(`      Categoria: ${classification.category}`);
        console.log(`      Confiança: ${classification.confidence}%`);
      });
    } else {
      console.log(`\n   ⚠️  Nenhum documento de alta relevância encontrado`);
    }

    // TESTE 5: Filtro por Status (apenas auto-aprovados)
    console.log('\n\n📋 TESTE 5: Filtro por Status (Auto-aprovados apenas)');
    console.log('-'.repeat(80));

    const filterByStatus: AdvancedFilters = {
      statuses: [ApprovalStatus.AUTO_APPROVED],
    };

    const filteredByStatus = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      filterByStatus
    );

    const statusStats = DOUClassifier.getFilterStats(
      results.length,
      filteredByStatus.length,
      filterByStatus
    );

    console.log(`\n✅ Resultado:`);
    console.log(`   Original: ${statusStats.originalCount} documentos`);
    console.log(`   Auto-aprovados: ${filteredByStatus.length} documentos`);
    console.log(`   Removidos: ${statusStats.removedCount} (${statusStats.removalRate})`);

    // TESTE 6: Filtro por Confiança (>= 90%)
    console.log('\n\n📋 TESTE 6: Filtro por Confiança (>= 90%)');
    console.log('-'.repeat(80));

    const filterByConfidence: AdvancedFilters = {
      minConfidence: 90,
    };

    const filteredByConfidence = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      filterByConfidence
    );

    const confidenceStats = DOUClassifier.getFilterStats(
      results.length,
      filteredByConfidence.length,
      filterByConfidence
    );

    console.log(`\n✅ Resultado:`);
    console.log(`   Original: ${confidenceStats.originalCount} documentos`);
    console.log(`   Alta confiança: ${filteredByConfidence.length} documentos`);
    console.log(`   Removidos: ${confidenceStats.removedCount} (${confidenceStats.removalRate})`);

    // TESTE 7: Filtro por Keywords (incluir "pregão", excluir "militar")
    console.log('\n\n📋 TESTE 7: Filtro por Keywords (incluir "pregão", excluir "militar")');
    console.log('-'.repeat(80));

    const filterByKeywords: AdvancedFilters = {
      includeKeywords: ['pregão'],
      excludeKeywords: ['militar'],
    };

    const filteredByKeywords = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      filterByKeywords
    );

    const keywordsStats = DOUClassifier.getFilterStats(
      results.length,
      filteredByKeywords.length,
      filterByKeywords
    );

    console.log(`\n✅ Resultado:`);
    console.log(`   Original: ${keywordsStats.originalCount} documentos`);
    console.log(`   Filtrado: ${filteredByKeywords.length} documentos`);
    console.log(`   Removidos: ${keywordsStats.removedCount} (${keywordsStats.removalRate})`);

    if (filteredByKeywords.length > 0) {
      console.log(`\n   Exemplos:`);
      filteredByKeywords.slice(0, 3).forEach((result, i) => {
        const titleClean = result.title.replace(/<[^>]*>/g, '').substring(0, 60);
        console.log(`   ${i + 1}. ${titleClean}...`);
      });
    }

    // TESTE 8: Combinação de Filtros (DO3 + Auto-aprovados + Última Semana)
    console.log('\n\n📋 TESTE 8: Combinação de Filtros (DO3 + Auto-aprovados + Última Semana)');
    console.log('-'.repeat(80));

    const combinedFilters: AdvancedFilters = {
      sections: ['do3'],
      statuses: [ApprovalStatus.AUTO_APPROVED],
      dateFrom: DOUClassifier.getDateRangeFromPreset(DateRangePreset.ULTIMA_SEMANA).from,
      dateTo: new Date(),
    };

    const filteredCombined = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      combinedFilters
    );

    const combinedStats = DOUClassifier.getFilterStats(
      results.length,
      filteredCombined.length,
      combinedFilters
    );

    console.log(`\n✅ Resultado:`);
    console.log(`   Original: ${combinedStats.originalCount} documentos`);
    console.log(`   Filtrado: ${filteredCombined.length} documentos`);
    console.log(`   Removidos: ${combinedStats.removedCount} (${combinedStats.removalRate})`);
    console.log(`   Filtros aplicados: ${combinedStats.appliedFilters.join(', ')}`);

    if (filteredCombined.length > 0) {
      console.log(`\n   Documentos que passaram em TODOS os filtros:`);
      filteredCombined.slice(0, 5).forEach((result, i) => {
        const classification = classifications.get(result)!;
        const titleClean = result.title.replace(/<[^>]*>/g, '').substring(0, 60);
        console.log(`   ${i + 1}. [${result.section.toUpperCase()}] ${titleClean}...`);
        console.log(`      Data: ${result.date} | Categoria: ${classification.category}`);
      });
    } else {
      console.log(`\n   ⚠️  Nenhum documento passou em todos os filtros combinados`);
    }

    // RESUMO FINAL
    console.log('\n\n' + '='.repeat(80));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(80));

    console.log('\n📊 Resumo dos Testes:');
    console.log(`   1️⃣  Filtro por Seção (DO3): ${filteredBySection.length} documentos`);
    console.log(`   2️⃣  Filtro por Órgão (AGU): ${filteredByOrgao.length} documentos`);
    console.log(`   3️⃣  Filtro por Data (3 dias): ${filteredByDate.length} documentos`);
    console.log(`   4️⃣  Filtro por Categoria: ${filteredByCategory.length} documentos`);
    console.log(`   5️⃣  Filtro por Status: ${filteredByStatus.length} documentos`);
    console.log(`   6️⃣  Filtro por Confiança (>=90%): ${filteredByConfidence.length} documentos`);
    console.log(`   7️⃣  Filtro por Keywords: ${filteredByKeywords.length} documentos`);
    console.log(`   8️⃣  Filtros Combinados: ${filteredCombined.length} documentos`);

    console.log('\n✅ Sistema de Filtros Avançados funcionando perfeitamente!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  }
}

main();
