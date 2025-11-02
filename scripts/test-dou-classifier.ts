/**
 * Script de Teste - DOU Document Classifier
 *
 * Testa o sistema de classificação automática
 */

import { searchLastWeek } from '@/lib/dou-api';
import { DOUClassifier, DOUDocumentCategory, ApprovalStatus } from '@/lib/dou-classifier';

async function main() {
  console.log('🚀 Teste do DOU Document Classifier\n');
  console.log('='.repeat(70));

  try {
    // Buscar últimas publicações
    console.log('\n📡 PASSO 1: Buscando publicações DOU (última semana)...\n');

    const results = await searchLastWeek('licitação OR agu OR decreto', undefined, 30);

    console.log(`✅ ${results.length} publicações encontradas\n`);

    if (results.length === 0) {
      console.log('⚠️  Nenhuma publicação encontrada');
      process.exit(0);
    }

    // Classificar documentos
    console.log('📊 PASSO 2: Classificando documentos...\n');

    const classifications = DOUClassifier.classifyBatch(results);

    // Estatísticas
    const stats = DOUClassifier.getStats(classifications);

    console.log('📈 Estatísticas de Classificação:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   ✅ Auto-aprovados: ${stats.autoApproved} (${Math.round((stats.autoApproved / stats.total) * 100)}%)`);
    console.log(`   ⏳ Revisão manual: ${stats.pending} (${Math.round((stats.pending / stats.total) * 100)}%)`);
    console.log(`   ❌ Auto-rejeitados: ${stats.autoRejected} (${Math.round((stats.autoRejected / stats.total) * 100)}%)`);

    console.log('\n📑 Por categoria:');
    Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });

    // Mostrar exemplos de cada status
    console.log('\n\n' + '='.repeat(70));
    console.log('📋 EXEMPLOS DE CLASSIFICAÇÃO');
    console.log('='.repeat(70));

    // Auto-aprovados
    const autoApproved = DOUClassifier.filterAutoApproved(classifications);
    if (autoApproved.length > 0) {
      console.log('\n✅ AUTO-APROVADOS (primeiros 3):');
      autoApproved.slice(0, 3).forEach((result, i) => {
        const classification = classifications.get(result)!;
        const titleClean = result.title.replace(/<[^>]*>/g, '').substring(0, 80);

        console.log(`\n${i + 1}. ${titleClean}...`);
        console.log(`   Categoria: ${classification.category}`);
        console.log(`   Confiança: ${classification.confidence}%`);
        console.log(`   Motivo: ${classification.reasoning.join(', ')}`);
        console.log(`   Seção: ${result.section} | Data: ${result.date}`);
      });
    }

    // Revisão manual
    const pending = DOUClassifier.filterPendingReview(classifications);
    if (pending.length > 0) {
      console.log('\n\n⏳ AGUARDANDO REVISÃO MANUAL (primeiros 3):');
      pending.slice(0, 3).forEach((result, i) => {
        const classification = classifications.get(result)!;
        const titleClean = result.title.replace(/<[^>]*>/g, '').substring(0, 80);

        console.log(`\n${i + 1}. ${titleClean}...`);
        console.log(`   Categoria: ${classification.category}`);
        console.log(`   Confiança: ${classification.confidence}%`);
        console.log(`   Motivo: ${classification.reasoning.join(', ')}`);
        console.log(`   Seção: ${result.section} | Data: ${result.date}`);
      });
    }

    // Auto-rejeitados
    const autoRejected = Array.from(classifications.entries())
      .filter(([_, c]) => c.status === ApprovalStatus.AUTO_REJECTED)
      .map(([r]) => r);

    if (autoRejected.length > 0) {
      console.log('\n\n❌ AUTO-REJEITADOS (primeiros 3):');
      autoRejected.slice(0, 3).forEach((result, i) => {
        const classification = classifications.get(result)!;
        const titleClean = result.title.replace(/<[^>]*>/g, '').substring(0, 80);

        console.log(`\n${i + 1}. ${titleClean}...`);
        console.log(`   Categoria: ${classification.category}`);
        console.log(`   Confiança: ${classification.confidence}%`);
        console.log(`   Motivo: ${classification.reasoning.join(', ')}`);
        console.log(`   Seção: ${result.section} | Data: ${result.date}`);
      });
    }

    // Resumo final
    console.log('\n\n' + '='.repeat(70));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(70));
    console.log('\n📊 Resumo:');
    console.log(`   📝 Total processado: ${results.length}`);
    console.log(`   ✅ Prontos para importar: ${autoApproved.length}`);
    console.log(`   ⏳ Precisam de revisão: ${pending.length}`);
    console.log(`   ❌ Filtrados (irrelevantes): ${autoRejected.length}`);
    console.log(`   🎯 Taxa de relevância: ${Math.round(((autoApproved.length + pending.length) / results.length) * 100)}%`);
    console.log('='.repeat(70));
  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  }
}

main();
