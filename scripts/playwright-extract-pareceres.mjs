/**
 * Script para extrair Pareceres Vinculantes filtrados usando Playwright
 *
 * Extrai os 61 pareceres filtrados pela busca "licitação" (7 páginas)
 * e salva em JSON para processamento posterior
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function extractPareceres() {
  console.log('🚀 Iniciando extração de Pareceres Vinculantes...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navegar para a página de busca com filtro
    console.log('📡 Navegando para página da AGU...');
    await page.goto('https://siscon.agu.gov.br/consultivo/vinculantes/');
    await page.waitForTimeout(2000);

    // Fazer busca por "licitação"
    console.log('🔍 Buscando por "licitação"...');
    await page.fill('input[type="search"]', 'licitação');
    await page.waitForTimeout(1500);

    const allPareceres = [];

    // Função para extrair pareceres da página atual
    async function extractCurrentPage() {
      const rows = await page.locator('table tbody tr').all();
      const pareceres = [];

      for (const row of rows) {
        try {
          const cells = await row.locator('td').all();
          if (cells.length >= 3) {
            const numeroCompleto = await cells[0].textContent();
            const assunto = await cells[1].textContent();
            const ementa = await cells[2].textContent();

            pareceres.push({
              numeroCompleto: numeroCompleto?.trim() || '',
              assunto: assunto?.trim() || '',
              ementa: ementa?.trim() || ''
            });
          }
        } catch (e) {
          console.log('   ⚠️ Erro ao extrair linha:', e.message);
        }
      }

      return pareceres;
    }

    // Extrair todas as páginas (1-7)
    for (let pageNum = 1; pageNum <= 7; pageNum++) {
      console.log(`\n📄 Extraindo página ${pageNum}/7...`);

      const pagePareceres = await extractCurrentPage();
      allPareceres.push(...pagePareceres);

      console.log(`   ✅ ${pagePareceres.length} pareceres extraídos`);
      console.log(`   📊 Total acumulado: ${allPareceres.length}`);

      // Se não é a última página, avançar
      if (pageNum < 7) {
        try {
          const nextButton = page.getByRole('link', { name: 'Avançar página' });
          await nextButton.click();
          await page.waitForTimeout(1500);
        } catch (e) {
          console.log(`   ⚠️ Não foi possível avançar para página ${pageNum + 1}`);
          break;
        }
      }
    }

    console.log(`\n🎯 EXTRAÇÃO COMPLETA: ${allPareceres.length} pareceres\n`);

    // Salvar em JSON
    const outputPath = join(process.cwd(), 'data', 'pareceres-extraidos-raw.json');
    writeFileSync(outputPath, JSON.stringify(allPareceres, null, 2), 'utf-8');

    console.log(`💾 Dados salvos em: ${outputPath}`);
    console.log('\n✅ Extração concluída com sucesso!');

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
    console.log(`\n📈 Resumo: ${pareceres.length} pareceres extraídos e salvos`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
