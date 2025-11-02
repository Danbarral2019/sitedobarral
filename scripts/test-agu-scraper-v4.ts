/**
 * Script de Teste - AGU Scraper v4
 *
 * Testa a nova plataforma unificada de scraping AGU
 */

import { scrapeAGU, convertAGUDocumentsToImport, generateAGUExcelReport } from '../lib/agu-scraper-v4';
import type { AGUScraperConfig } from '../lib/agu-types';
import * as fs from 'fs/promises';

async function main() {
  console.log('='.repeat(80));
  console.log('AGU SCRAPER V4 - TESTE COMPLETO');
  console.log('='.repeat(80));
  console.log('');

  // =====================================
  // TESTE 1: Todos os Tipos Implementados
  // =====================================
  console.log('\n📋 TESTE 1: Scraping de TODOS os Tipos Implementados');
  console.log('-'.repeat(80));

  const config1: AGUScraperConfig = {
    tipos: ['orientacao-normativa', 'sumula', 'parecer-vinculante'],
    anoInicio: 2020,
    filtroRelevancia: true,
    saveScreenshots: false,
  };

  const result1 = await scrapeAGU(config1);

  console.log('\n📊 Resultados:');
  console.log(`   Total de documentos: ${result1.totalDocuments}`);
  console.log(`   Documentos relevantes: ${result1.totalRelevant}`);
  console.log(`   Taxa de relevância: ${result1.stats.taxaRelevancia.toFixed(1)}%`);
  console.log(`   Score médio: ${result1.stats.scoreMedio.toFixed(1)}`);
  console.log(`   Tempo de execução: ${(result1.executionTime / 1000).toFixed(2)}s`);

  if (result1.errors.length > 0) {
    console.log(`\n❌ Erros encontrados: ${result1.errors.length}`);
    result1.errors.forEach(err => console.log(`   - ${err}`));
  }

  // Mostra distribuição por curso
  console.log('\n📚 Distribuição por Curso:');
  Object.entries(result1.stats.porCurso)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cursoId, count]) => {
      console.log(`   Curso ${cursoId}: ${count} documentos`);
    });

  // Mostra top 5 temas
  console.log('\n🏷️  Top 5 Temas:');
  Object.entries(result1.stats.porTema)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([tema, count]) => {
      console.log(`   ${tema}: ${count} documentos`);
    });

  // Mostra alguns exemplos de documentos
  console.log('\n📄 Exemplos de Documentos Encontrados:');
  const allDocs = result1.results.flatMap(r => r.documentos);
  allDocs.slice(0, 5).forEach((doc, idx) => {
    console.log(`\n   ${idx + 1}. ${doc.titulo}`);
    console.log(`      Tipo: ${doc.tipo}`);
    console.log(`      Relevância: ${doc.relevanciaScore}/100 (${doc.isRelevante ? 'SIM' : 'NÃO'})`);
    console.log(`      Cursos: ${doc.cursosIds.join(', ')}`);
    console.log(`      Temas: ${doc.temas.join(', ')}`);
    console.log(`      URL: ${doc.url.substring(0, 60)}...`);
  });

  // =====================================
  // TESTE 2: Distribuição por Tipo
  // =====================================
  console.log('\n\n📋 TESTE 2: Distribuição por Tipo de Documento');
  console.log('-'.repeat(80));
  Object.entries(result1.stats.porTipo)
    .forEach(([tipo, count]) => {
      console.log(`   ${tipo}: ${count} documentos`);
    });

  console.log('\n⚠️  Tipos não implementados (Fase 3):');
  console.log('   - Modelos de Licitações');
  console.log('   - Guias e Manuais');
  console.log('   - Notas Técnicas');

  // =====================================
  // EXPORTAÇÕES
  // =====================================
  console.log('\n\n📤 EXPORTANDO RESULTADOS');
  console.log('-'.repeat(80));

  // Exporta para formato de importação no banco
  const importData = convertAGUDocumentsToImport(allDocs);
  await fs.writeFile(
    'agu-scraper-v4-import.json',
    JSON.stringify(importData, null, 2),
    'utf-8'
  );
  console.log(`✅ Dados para importação salvos: agu-scraper-v4-import.json (${importData.length} documentos)`);

  // Exporta para Excel (formato CSV)
  const excelData = generateAGUExcelReport(allDocs);
  const csv = excelData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  await fs.writeFile('agu-scraper-v4-report.csv', csv, 'utf-8');
  console.log(`✅ Relatório Excel salvo: agu-scraper-v4-report.csv`);

  // =====================================
  // COMPARAÇÃO COM VERSÃO ANTIGA
  // =====================================
  console.log('\n\n📊 COMPARAÇÃO: v3 (antiga) vs v4 (nova)');
  console.log('-'.repeat(80));
  console.log('Versão v3 (regex):');
  console.log('   - 1 tipo de documento (apenas ONs)');
  console.log('   - Parsing frágil com regex');
  console.log('   - Sem suporte a JavaScript');
  console.log('   - Sem screenshots para debug');
  console.log('   - Manutenção difícil');
  console.log('');
  console.log('Versão v4 (Playwright MCP ready):');
  console.log('   - 6 tipos de documentos planejados');
  console.log('   - Parsing robusto (preparado para Playwright)');
  console.log('   - Suporte completo a JavaScript (com MCP)');
  console.log('   - Screenshots automáticos');
  console.log('   - Código modular e manutenível');
  console.log('   - Análise avançada de relevância');
  console.log('   - Sugestão automática de cursos');

  // =====================================
  // INSTRUÇÕES PARA USO COM PLAYWRIGHT MCP
  // =====================================
  console.log('\n\n🎭 COMO USAR COM PLAYWRIGHT MCP');
  console.log('-'.repeat(80));
  console.log('Via Claude Code CLI:');
  console.log('');
  console.log('   "Use Playwright MCP para fazer scraping da página de');
  console.log('   Pareceres Vinculantes da AGU e extrair todos os pareceres"');
  console.log('');
  console.log('O Playwright MCP irá:');
  console.log('   1. Abrir navegador headless');
  console.log('   2. Navegar para a página');
  console.log('   3. Aguardar JavaScript carregar');
  console.log('   4. Extrair dados com seletores CSS');
  console.log('   5. Salvar screenshot para auditoria');
  console.log('');

  console.log('\n' + '='.repeat(80));
  console.log('✅ TESTE CONCLUÍDO');
  console.log('='.repeat(80));
}

main().catch(console.error);
