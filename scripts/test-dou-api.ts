/**
 * Script de Teste - API Oficial do DOU
 *
 * Testa a integração com a API da Imprensa Nacional
 * para buscar publicações do Diário Oficial da União
 */

import { searchLastWeek, DOUSection } from '@/lib/dou-api';
import { analyzeRelevanceDOU } from '@/lib/dou-module';

async function main() {
  console.log('🚀 Teste da API Oficial do DOU\n');
  console.log('='.repeat(60));

  try {
    // PASSO 1: Buscar publicações da última semana
    console.log('\n📡 PASSO 1: Buscando no DOU (última semana)...\n');

    const searchTerm = 'licitação OR pregão OR dispensa';

    console.log(`   Termo: ${searchTerm}`);
    console.log(`   Período: última semana`);
    console.log(`   Seções: Todas`);

    const results = await searchLastWeek(searchTerm, [DOUSection.TODOS], 50);

    console.log(`\n✅ Busca concluída:`);
    console.log(`   Total de publicações: ${results.length}`);

    if (results.length === 0) {
      console.log('\n⚠️  Nenhuma publicação encontrada. Encerrando teste.');
      process.exit(0);
    }

    // PASSO 2: Mostrar exemplos
    console.log('\n📋 PASSO 2: Exemplos de publicações encontradas:\n');

    for (let i = 0; i < Math.min(5, results.length); i++) {
      const item = results[i];
      console.log(`\n${i + 1}. ${item.title.slice(0, 100)}...`);
      console.log(`   Seção: ${item.section}`);
      console.log(`   Data: ${item.date}`);
      console.log(`   Órgão: ${item.hierarchyStr.slice(0, 80)}...`);
      console.log(`   URL: ${item.href}`);

      // Analisar relevância
      const analysis = analyzeRelevanceDOU(item.title, item.abstract);
      console.log(`   Score: ${analysis.score} | Relevante: ${analysis.isRelevant ? 'SIM ✅' : 'NÃO ❌'}`);
      if (analysis.temas.length > 0) {
        console.log(`   Temas: ${analysis.temas.join(', ')}`);
      }
    }

    // PASSO 3: Estatísticas de relevância
    console.log('\n📊 PASSO 3: Análise de relevância...\n');

    const relevanceAnalysis = results.map(item => {
      const analysis = analyzeRelevanceDOU(item.title, item.abstract);
      return {
        item,
        ...analysis,
      };
    });

    const relevant = relevanceAnalysis.filter(a => a.isRelevant);

    console.log(`   Total analisado: ${relevanceAnalysis.length}`);
    console.log(`   Relevantes: ${relevant.length} (${Math.round((relevant.length / relevanceAnalysis.length) * 100)}%)`);
    console.log(`   Não relevantes: ${relevanceAnalysis.length - relevant.length}`);

    // PASSO 4: Distribuição por seção
    console.log('\n📑 PASSO 4: Distribuição por seção...\n');

    const sectionCounts: Record<string, number> = {};
    results.forEach(item => {
      sectionCounts[item.section] = (sectionCounts[item.section] || 0) + 1;
    });

    Object.entries(sectionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([section, count]) => {
        console.log(`   ${section}: ${count} publicações`);
      });

    // RESUMO FINAL
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n📊 Resumo:');
    console.log(`   ✅ Publicações encontradas: ${results.length}`);
    console.log(`   ✅ Publicações relevantes: ${relevant.length} (${Math.round((relevant.length / results.length) * 100)}%)`);
    console.log(`   ✅ Seções diferentes: ${Object.keys(sectionCounts).length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  }
}

main();
