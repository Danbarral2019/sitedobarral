/**
 * Script de Teste - Módulo de Súmulas AGU
 */

import { scrapeAGU } from '../lib/agu-scraper-v4';

async function main() {
  console.log('='.repeat(80));
  console.log('TESTE - MÓDULO DE SÚMULAS AGU');
  console.log('='.repeat(80));
  console.log('');

  const result = await scrapeAGU({
    tipos: ['sumula'],
    anoInicio: 1997,
    filtroRelevancia: false, // TODAS as súmulas (para ver total)
  });

  console.log('\n📊 Resultados:');
  console.log(`   Total de súmulas: ${result.totalDocuments}`);
  console.log(`   Relevantes: ${result.totalRelevant}`);
  console.log(`   Taxa de relevância: ${result.stats.taxaRelevancia.toFixed(1)}%`);
  console.log(`   Score médio: ${result.stats.scoreMedio.toFixed(1)}`);
  console.log(`   Tempo de execução: ${(result.executionTime / 1000).toFixed(2)}s`);

  if (result.errors.length > 0) {
    console.log(`\n❌ Erros: ${result.errors.length}`);
    result.errors.forEach(err => console.log(`   - ${err}`));
  }

  // Distribuição por curso
  console.log('\n📚 Distribuição por Curso:');
  Object.entries(result.stats.porCurso)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cursoId, count]) => {
      console.log(`   Curso ${cursoId}: ${count} súmulas`);
    });

  // Top 5 temas
  console.log('\n🏷️  Top 5 Temas:');
  Object.entries(result.stats.porTema)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([tema, count]) => {
      console.log(`   ${tema}: ${count} súmulas`);
    });

  // Exemplos de súmulas
  console.log('\n📄 Primeiras 5 Súmulas Relevantes:');
  const docs = result.results.flatMap(r => r.documentos).slice(0, 5);
  docs.forEach((doc, i) => {
    console.log(`\n   ${i + 1}. ${doc.titulo}`);
    console.log(`      Data: ${doc.dataPublicacao || 'N/A'}`);
    console.log(`      Relevância: ${doc.relevanciaScore}/100`);
    console.log(`      Cursos: ${doc.cursosIds.join(', ')}`);
    console.log(`      Temas: ${doc.temas.join(', ')}`);
    console.log(`      Enunciado: ${doc.descricao.substring(0, 150)}...`);
    if (doc.tags.includes('Revogada')) {
      console.log(`      ⚠️  STATUS: Revogada`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ TESTE CONCLUÍDO');
  console.log('='.repeat(80));
}

main().catch(console.error);
