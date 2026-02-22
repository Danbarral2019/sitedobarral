/**
 * Script de Teste - DOU Content Scraper
 *
 * Testa o scraping de conteúdo completo de publicações DOU
 */

import { searchLastWeek } from '@/lib/dou-api';
import { scrapeURL, scrapeURLs } from '@/lib/dou-scraper';

async function main() {
  console.log('🚀 Teste do DOU Content Scraper\n');
  console.log('='.repeat(60));

  try {
    // TESTE 1: Scraping de uma URL única
    console.log('\n📡 TESTE 1: Scraping de URL única...\n');

    const testURL = 'http://www.in.gov.br/web/dou/-/aviso-de-licitacao-666140408';

    console.log(`   URL: ${testURL}`);

    const content = await scrapeURL(testURL);

    if (content) {
      console.log('\n✅ Conteúdo extraído com sucesso:');
      console.log(`   Edição: ${content.edicao}`);
      console.log(`   Seção: ${content.secao}`);
      console.log(`   Página: ${content.pagina}`);
      console.log(`   Data: ${content.data}`);
      console.log(`   Órgão: ${content.orgao.substring(0, 80)}...`);
      console.log(`   Caracteres: ${content.caracteres}`);
      console.log(`   Parágrafos: ${content.paragrafos}`);
      console.log(`\n   Prévia do conteúdo (primeiros 300 chars):`);
      console.log(`   ${content.conteudo.substring(0, 300)}...`);
    } else {
      console.log('\n❌ Falha ao extrair conteúdo');
    }

    // TESTE 2: Scraping de múltiplas URLs da API
    console.log('\n\n📡 TESTE 2: Scraping de múltiplas URLs...\n');

    console.log('   Buscando últimas publicações DOU...');

    const results = await searchLastWeek('licitação', undefined, 5);

    console.log(`   Encontradas: ${results.length} publicações\n`);

    if (results.length === 0) {
      console.log('   ⚠️  Nenhuma publicação encontrada');
      process.exit(0);
    }

    // Pegar apenas as 3 primeiras para teste
    const urls = results.slice(0, 3).map((r) => r.href);

    console.log('   URLs a processar:');
    urls.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`);
    });

    console.log('\n   Iniciando scraping (delay 2s entre requisições)...\n');

    const enrichedContents = await scrapeURLs(urls, 2000);

    console.log('\n✅ Scraping concluído!\n');

    // Mostrar resultados
    let sucessos = 0;
    let totalCaracteres = 0;

    enrichedContents.forEach((content, url) => {
      sucessos++;
      totalCaracteres += content.caracteres;

      const urlShort = url.split('/').pop() || url;

      console.log(`\n📄 ${urlShort}`);
      console.log(`   Edição: ${content.edicao || 'N/A'} | Seção: ${content.secao || 'N/A'} | Página: ${content.pagina || 'N/A'}`);
      console.log(`   Órgão: ${content.orgao.substring(0, 60)}...`);
      console.log(`   Texto: ${content.caracteres} chars, ${content.paragrafos} parágrafos`);
      console.log(`   Prévia: ${content.conteudo.substring(0, 150)}...`);
    });

    // Estatísticas finais
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n📊 Estatísticas:');
    console.log(`   URLs processadas: ${urls.length}`);
    console.log(`   Sucessos: ${sucessos} (${Math.round((sucessos / urls.length) * 100)}%)`);
    console.log(`   Total de caracteres extraídos: ${totalCaracteres.toLocaleString()}`);
    console.log(`   Média por documento: ${Math.round(totalCaracteres / sucessos).toLocaleString()} chars`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  }
}

main();
