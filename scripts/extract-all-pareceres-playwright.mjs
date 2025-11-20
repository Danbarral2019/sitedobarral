/**
 * Script Automatizado: Extração Completa de Pareceres Vinculantes AGU
 *
 * Extrai TODOS os 61 pareceres filtrados por "licitação" usando Playwright
 * Navega automaticamente pelas 7 páginas e salva em JSON
 *
 * Uso: node scripts/extract-all-pareceres-playwright.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const URL_BASE = 'https://siscon.agu.gov.br/consultivo/vinculantes/';
const SEARCH_TERM = 'licitação';
const TOTAL_PAGES = 7;
const TIMEOUT_NAVIGATION = 3000; // 3 segundos entre páginas

async function extractPareceres() {
  console.log('🚀 Iniciando extração automatizada de Pareceres Vinculantes AGU\n');
  console.log(`📍 URL: ${URL_BASE}`);
  console.log(`🔍 Filtro: "${SEARCH_TERM}"`);
  console.log(`📄 Total de páginas: ${TOTAL_PAGES}\n`);

  const browser = await chromium.launch({
    headless: true,
    timeout: 60000
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // 1. Navegar para a página
    console.log('📡 Navegando para a página da AGU...');
    await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2. Fazer busca por "licitação"
    console.log(`🔍 Buscando por "${SEARCH_TERM}"...`);

    // Localizar o campo de busca e inserir o termo
    const searchInput = page.locator('input[type="search"]').first();
    await searchInput.fill(SEARCH_TERM);
    await page.waitForTimeout(2000); // Aguardar filtro aplicar

    console.log('✅ Filtro aplicado\n');

    const allPareceres = [];

    // 3. Extrair pareceres de cada página
    for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
      console.log(`📄 Página ${pageNum}/${TOTAL_PAGES}...`);

      // Aguardar tabela carregar
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Extrair dados da página atual
      const pageData = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        const pareceres = [];

        rows.forEach(row => {
          try {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              // Extrair texto das células
              const numeroCompleto = cells[0]?.textContent?.trim() || '';
              const assunto = cells[1]?.textContent?.trim() || '';
              const ementa = cells[2]?.textContent?.trim() || '';

              // Só adicionar se houver dados válidos
              if (numeroCompleto && assunto) {
                pareceres.push({
                  numeroCompleto,
                  assunto,
                  ementa
                });
              }
            }
          } catch (err) {
            console.error('Erro ao processar linha:', err.message);
          }
        });

        return pareceres;
      });

      console.log(`   ✅ ${pageData.length} pareceres extraídos`);
      allPareceres.push(...pageData);
      console.log(`   📊 Total acumulado: ${allPareceres.length}\n`);

      // 4. Navegar para próxima página (se não for a última)
      if (pageNum < TOTAL_PAGES) {
        try {
          // Localizar botão "Avançar página" usando getByRole
          const nextButton = page.getByRole('button', { name: 'Avançar página' });

          // Verificar se está habilitado
          const isDisabled = await nextButton.getAttribute('disabled');
          if (isDisabled) {
            console.log('⚠️  Botão "Avançar" desabilitado - fim das páginas');
            break;
          }

          await nextButton.click();
          await page.waitForTimeout(TIMEOUT_NAVIGATION);

        } catch (err) {
          console.log(`⚠️  Erro ao navegar para página ${pageNum + 1}: ${err.message}`);
          break;
        }
      }
    }

    console.log(`\n🎯 EXTRAÇÃO COMPLETA!`);
    console.log(`   Total extraído: ${allPareceres.length} pareceres\n`);

    // 5. Salvar em JSON
    const dataDir = join(__dirname, '..', 'data');
    mkdirSync(dataDir, { recursive: true });

    const outputPath = join(dataDir, 'pareceres-vinculantes-raw.json');
    writeFileSync(outputPath, JSON.stringify(allPareceres, null, 2), 'utf-8');

    console.log(`💾 Dados salvos em: ${outputPath}`);
    console.log(`\n✅ Extração concluída com sucesso!`);

    await browser.close();
    return allPareceres;

  } catch (error) {
    console.error('\n❌ Erro durante extração:', error);
    await browser.close();
    throw error;
  }
}

// Executar
extractPareceres()
  .then(pareceres => {
    console.log(`\n📈 Resumo Final:`);
    console.log(`   Pareceres extraídos: ${pareceres.length}`);
    console.log(`   Próximo passo: Executar análise de relevância`);
    console.log(`   Comando: npx tsx scripts/process-pareceres-relevancia.ts`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
