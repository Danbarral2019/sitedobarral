/**
 * Coleta dos Espelhos de Acórdãos do STJ — casca de CLI.
 *
 *   npm run stj:coletar                          # 2 meses, como o cron
 *   npm run stj:coletar -- --tudo                # acervo inteiro
 *   npm run stj:coletar -- --dry-run
 *   npm run stj:coletar -- --tudo --sem-resumo
 *
 * `--sem-resumo` desliga a geração de resumo IA, que chama Gemini por julgado
 * aprovado. No backfill do acervo isso seriam milhares de chamadas.
 */
import { coletarStj } from '../lib/stj/coletar';
import { SCRAPER_CODE_STJ } from '../lib/stj/constantes';
import { logScraperHealth } from '../lib/tribunal-scrapers/utils';

async function main() {
  const args = process.argv.slice(2);
  const inicio = Date.now();

  const r = await coletarStj({
    meses: args.includes('--tudo') ? Number.MAX_SAFE_INTEGER : 2,
    dryRun: args.includes('--dry-run'),
    gerarResumo: !args.includes('--sem-resumo'),
    forcar: args.includes('--forcar'),
  });

  console.log('\n=== resultado ===');
  console.log(r);

  // Alinhado com a rota de cron (app/api/cron/sync-stj/route.ts): só falha
  // total (nenhum dump lido) vira `failure` — erro parcial é `partial_failure`.
  const status = r.dumpsLidos === 0 ? 'failure' : r.erros > 0 ? 'partial_failure' : 'success';

  if (!args.includes('--dry-run')) {
    await logScraperHealth(SCRAPER_CODE_STJ, status, {
      itemsFound: r.relevantes,
      itemsNew: r.criados,
      itemsError: r.erros,
      duration: Date.now() - inicio,
      errorMessage: r.mensagensErro.length > 0 ? r.mensagensErro.slice(0, 5).join('; ') : undefined,
    });
  }

  if (r.dumpsLidos === 0) {
    console.error('Nenhum dump lido — verifique os cabeçalhos em lib/stj/consulta.ts');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
