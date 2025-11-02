/**
 * Script de Teste - Módulo de Pareceres CONUNI (DECOR)
 */

import { scrapeAGU } from '../lib/agu-scraper-v4';

async function main() {
  console.log('='.repeat(80));
  console.log('TESTE - MÓDULO DE PARECERES CONUNI (DECOR)');
  console.log('='.repeat(80));
  console.log('');

  const result = await scrapeAGU({
    tipos: ['parecer-conuni'],
    anoInicio: 2020,
    filtroRelevancia: false, // Todas (para ver total)
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
      console.log(`      Tags: ${doc.tags.join(', ')}`);
      console.log(`      URL: ${doc.url}`);
    });
  } else {
    console.log('\n⚠️  Nenhum parecer encontrado');
    console.log('   A página DECOR usa JavaScript para carregar dados.');
    console.log('   Para scraping completo, use Playwright MCP:');
    console.log('');
    console.log('   "Use Playwright MCP para navegar até https://cgu.agu.gov.br/decor/');
    console.log('   e extrair todos os pareceres CONUNI com seus números, assuntos e links"');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ TESTE CONCLUÍDO');
  console.log('='.repeat(80));
}

main().catch(console.error);
