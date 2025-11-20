/**
 * Script Automatizado: Extração Completa de Pareceres DECOR (CONUNI)
 *
 * Extrai TODOS os 1.641 pareceres DECOR usando Playwright
 * Navega automaticamente pelas ~165 páginas e salva em JSON
 *
 * Uso: node scripts/extract-decor-playwright.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const URL_BASE = 'https://cgu.agu.gov.br/decor/';
const TOTAL_ESTIMATED = 1641; // Total de manifestações conforme página
const ITEMS_PER_PAGE = 10;
const MAX_PAGES = Math.ceil(TOTAL_ESTIMATED / ITEMS_PER_PAGE); // ~165 páginas
const TIMEOUT_NAVIGATION = 2000; // 2 segundos entre páginas

async function extractDECOR() {
  console.log('🚀 Iniciando extração automatizada de Pareceres DECOR (CONUNI)\n');
  console.log(`📍 URL: ${URL_BASE}`);
  console.log(`📊 Total estimado: ${TOTAL_ESTIMATED} manifestações`);
  console.log(`📄 Páginas estimadas: ${MAX_PAGES}\n`);

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
    console.log('📡 Navegando para a página DECOR...');
    await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('✅ Página carregada\n');

    const allPareceres = [];
    let currentPage = 1;

    // 2. Extrair pareceres de cada página
    while (currentPage <= MAX_PAGES) {
      console.log(`📄 Página ${currentPage}/${MAX_PAGES}...`);

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
              // Coluna 1: Manifestação (número e link)
              const manifestacaoCell = cells[0];
              const linkElement = manifestacaoCell.querySelector('a');
              const numeroCompleto = linkElement?.textContent?.trim() || '';
              const urlDocumento = linkElement?.href || '';

              // Coluna 2: Assunto
              const assunto = cells[1]?.textContent?.trim() || '';

              // Coluna 3: Ementa
              const ementa = cells[2]?.textContent?.trim() || '';

              // Só adicionar se houver dados válidos
              if (numeroCompleto && assunto) {
                pareceres.push({
                  numeroCompleto,
                  assunto,
                  ementa,
                  urlDocumento
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

      // 3. Verificar se há próxima página e navegar
      if (currentPage < MAX_PAGES) {
        try {
          // Localizar botão "Avançar página" dentro do container de paginação
          const nextButton = page.locator('#numlinhas').getByRole('button', { name: 'Avançar página' });

          // Verificar se está habilitado
          const isDisabled = await nextButton.isDisabled();
          if (isDisabled) {
            console.log('⚠️  Botão "Avançar" desabilitado - fim das páginas');
            break;
          }

          await nextButton.click();
          await page.waitForTimeout(TIMEOUT_NAVIGATION);
          currentPage++;

        } catch (err) {
          console.log(`⚠️  Erro ao navegar para página ${currentPage + 1}: ${err.message}`);
          console.log(`   Possível fim da paginação. Total extraído: ${allPareceres.length}`);
          break;
        }
      } else {
        currentPage++;
      }

      // Segurança: parar se extraiu mais que o esperado
      if (allPareceres.length >= TOTAL_ESTIMATED + 100) {
        console.log('⚠️  Limite de segurança atingido');
        break;
      }
    }

    console.log(`\n🎯 EXTRAÇÃO COMPLETA!`);
    console.log(`   Total extraído: ${allPareceres.length} pareceres\n`);

    // 4. Salvar em JSON
    const dataDir = join(__dirname, '..', 'data');
    mkdirSync(dataDir, { recursive: true });

    const outputPath = join(dataDir, 'decor-raw.json');
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
extractDECOR()
  .then(pareceres => {
    console.log(`\n📈 Resumo Final:`);
    console.log(`   Pareceres DECOR extraídos: ${pareceres.length}`);
    console.log(`   Próximo passo: Executar análise de relevância`);
    console.log(`   Comando: npx tsx scripts/process-decor-relevancia.ts`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
