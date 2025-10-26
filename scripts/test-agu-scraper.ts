/**
 * Script de teste para o scraper AGU v2
 *
 * Testa:
 * - Quantidade de ONs encontradas (deve ser 66+, não 21)
 * - Extração de links de fundamentação
 * - Validação de URLs
 * - Limpeza de títulos (sem HTML)
 */

import { scrapeOrientacoesAGU, convertOrientacoesToDocuments } from '../lib/agu-scraper';

async function testScraper() {
  console.log('🔍 Testando scraper AGU v2...\n');

  try {
    // 1. Faz scraping
    const orientacoes = await scrapeOrientacoesAGU();

    // 2. Estatísticas gerais
    console.log('📊 ESTATÍSTICAS GERAIS:');
    console.log(`  Total de ONs encontradas: ${orientacoes.length}`);
    console.log(`  Expectativa mínima: 66 ONs\n`);

    // 3. Links de fundamentação
    const totalFundamentacaoLinks = orientacoes.reduce(
      (sum, on) => sum + on.fundamentacaoLinks.length,
      0
    );
    const onsComFundamentacao = orientacoes.filter(on => on.fundamentacaoLinks.length > 0).length;
    const onsComMultiplosFundamentacao = orientacoes.filter(
      on => on.fundamentacaoLinks.length > 1
    ).length;

    console.log('📄 LINKS DE FUNDAMENTAÇÃO:');
    console.log(`  Total de links extraídos: ${totalFundamentacaoLinks}`);
    console.log(`  ONs com pelo menos 1 link: ${onsComFundamentacao}`);
    console.log(`  ONs com múltiplos links: ${onsComMultiplosFundamentacao}\n`);

    // 4. Versões históricas
    const onsComVersaoHistorica = orientacoes.filter(on => on.versaoHistorica).length;
    console.log('📅 VERSÕES HISTÓRICAS:');
    console.log(`  ONs com versão histórica: ${onsComVersaoHistorica}\n`);

    // 5. Amostras
    console.log('📝 AMOSTRAS (primeiras 5 ONs):');
    orientacoes.slice(0, 5).forEach((on, i) => {
      console.log(`\n  ${i + 1}. ${on.numero}`);
      console.log(`     Título: ${on.titulo.substring(0, 80)}${on.titulo.length > 80 ? '...' : ''}`);
      console.log(`     Fundamentação: ${on.fundamentacaoLinks.length} link(s)`);
      console.log(`     Tags: ${on.tags.join(', ')}`);
      if (on.versaoHistorica) {
        console.log(`     Versão: ${on.versaoHistorica}`);
      }

      // Verifica se há HTML no título
      if (on.titulo.includes('<') || on.titulo.includes('>') || on.titulo.includes('data-')) {
        console.log(`     ⚠️  ALERTA: Título contém HTML/atributos!`);
      }
    });

    // 6. Converte para documentos
    const documents = convertOrientacoesToDocuments(orientacoes);
    console.log('\n📦 DOCUMENTOS GERADOS:');
    console.log(`  Total de documentos: ${documents.length}`);
    console.log(`  (Orientações com múltiplos links geram múltiplos documentos)\n`);

    // 7. Validação de URLs
    const docsComUrlInvalida = documents.filter(doc => {
      try {
        new URL(doc.url);
        return false;
      } catch {
        return true;
      }
    });

    console.log('🔗 VALIDAÇÃO DE URLs:');
    console.log(`  URLs válidas: ${documents.length - docsComUrlInvalida.length}`);
    console.log(`  URLs inválidas: ${docsComUrlInvalida.length}`);
    if (docsComUrlInvalida.length > 0) {
      console.log('  ⚠️  URLs inválidas encontradas:');
      docsComUrlInvalida.slice(0, 3).forEach(doc => {
        console.log(`    - ${doc.title}: ${doc.url}`);
      });
    }

    // 8. Resultado final
    console.log('\n✅ RESULTADO:');
    const sucesso = orientacoes.length >= 60 && docsComUrlInvalida.length === 0;
    if (sucesso) {
      console.log('  ✅ Scraper funcionando corretamente!');
      console.log(`  ✅ ${orientacoes.length} ONs encontradas (≥60 esperado)`);
      console.log(`  ✅ ${totalFundamentacaoLinks} links de fundamentação extraídos`);
      console.log(`  ✅ Todas as URLs são válidas`);
    } else {
      console.log('  ⚠️  Problemas detectados:');
      if (orientacoes.length < 60) {
        console.log(`    - Apenas ${orientacoes.length} ONs encontradas (esperado ≥60)`);
      }
      if (docsComUrlInvalida.length > 0) {
        console.log(`    - ${docsComUrlInvalida.length} URLs inválidas`);
      }
    }

  } catch (error) {
    console.error('❌ ERRO ao testar scraper:', error);
    if (error instanceof Error) {
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

// Executa o teste
testScraper();
