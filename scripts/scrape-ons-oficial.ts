/**
 * scrape-ons-oficial.ts
 *
 * Faz scrape do portal oficial da AGU (gov.br/agu/.../onsagu) e salva o
 * resultado em docs/audits/2026-04-30-ons-scraped.json.
 *
 * Read-only — não toca no DB. O script de aplicação é separado
 * (apply-ons-from-scrape.ts) e exige a flag --apply.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/scrape-ons-oficial.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { scrapeOrientacoesNormativas } from '../lib/agu-modules/orientacoes-normativas';
import type { AGUScraperConfig } from '../lib/agu-types';

async function main() {
  console.log('='.repeat(60));
  console.log('SCRAPE-ONS-OFICIAL — read-only');
  console.log('='.repeat(60));
  console.log('Origem: https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu');
  console.log('');

  const config: AGUScraperConfig = {
    tipos: ['orientacao-normativa'],
    filtroRelevancia: false,
  };

  const result = await scrapeOrientacoesNormativas(config);

  if (!result.success) {
    console.error('Scraper falhou:', result.errors);
    process.exit(1);
  }

  console.log(`\nTotal de ONs extraídas: ${result.documentos.length}`);
  console.log(`Tempo de execução: ${result.executionTime}ms`);

  // Stats rápidas
  const comDOU = result.documentos.filter((d) => d.douUrl).length;
  const comFundamentacao = result.documentos.filter(
    (d) => d.url && !d.url.endsWith('/onsagu')
  ).length;
  console.log(`  • Com link DOU: ${comDOU}/${result.documentos.length}`);
  console.log(`  • Com link de fundamentação específico: ${comFundamentacao}/${result.documentos.length}`);

  // Mostra amostra
  console.log('\nAmostra (primeiros 5):');
  for (const doc of result.documentos.slice(0, 5)) {
    console.log(`  ON ${doc.numeroInt}/${doc.ano}: ${doc.titulo.substring(0, 80)}`);
    if (doc.douUrl) console.log(`     DOU: ${doc.douUrl}`);
  }

  // Salva JSON
  const outDir = path.join(process.cwd(), 'docs', 'audits');
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `${today}-ons-scraped.json`);

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        scrapedAt: new Date().toISOString(),
        source: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu',
        total: result.documentos.length,
        documentos: result.documentos,
      },
      null,
      2
    )
  );
  console.log(`\n✅ JSON salvo: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
