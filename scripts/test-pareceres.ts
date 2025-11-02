/**
 * Script de Teste - Módulo de Pareceres Vinculantes AGU
 */

import { scrapeAGU } from '../lib/agu-scraper-v4';

async function main() {
  console.log('='.repeat(80));
  console.log('TESTE - MÓDULO DE PARECERES VINCULANTES AGU');
  console.log('='.repeat(80));
  console.log('');

  const result = await scrapeAGU({
    tipos: ['parecer-vinculante'],
    filtroRelevancia: false,
  });

  console.log('\n📊 Resultados:');
  console.log(`   Total de pareceres: ${result.totalDocuments}`);
  console.log(`   Relevantes: ${result.totalRelevant}`);
  console.log(`   Taxa de relevância: ${result.stats.taxaRelevancia.toFixed(1)}%`);
  console.log(`   Tempo de execução: ${(result.executionTime / 1000).toFixed(2)}s`);

  if (result.errors.length > 0) {
    console.log(`\n❌ Erros: ${result.errors.length}`);
    result.errors.forEach(err => console.log(`   - ${err}`));
  }

  if (result.results[0]?.warnings && result.results[0].warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${result.results[0].warnings.length}`);
    result.results[0].warnings.forEach(warn => console.log(`   - ${warn}`));
  }

  // Primeiros pareceres
  if (result.totalDocuments > 0) {
    console.log('\n📄 Pareceres Encontrados:');
    const docs = result.results.flatMap(r => r.documentos).slice(0, 5);
    docs.forEach((doc, i) => {
      console.log(`\n   ${i + 1}. ${doc.titulo}`);
      console.log(`      Relevância: ${doc.relevanciaScore}/100`);
      console.log(`      Cursos: ${doc.cursosIds.join(', ')}`);
      console.log(`      URL: ${doc.url}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ TESTE CONCLUÍDO');
  console.log('='.repeat(80));
}

main().catch(console.error);
