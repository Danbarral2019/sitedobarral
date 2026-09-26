/**
 * Carga inicial de um tribunal judicial novo (TRF5 ou TJDFT) a partir de uma
 * data de julgamento. Classifica com a IA calibrada sem teto de orçamento.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/importar-tribunal.ts --tribunal trf5 --desde 2025-01-01
 *
 * Idempotente: só grava o que ainda não está no banco.
 * Custo: julgamento de IA para os casos que a palavra-chave não decide +
 * 1 resumo no Gemini por decisão aprovada.
 */
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { definirOrcamentoIA } from '@/lib/tribunal-scrapers/classifier';
import { trf5Scraper } from '@/lib/tribunal-scrapers/trf5';
import { tjdftScraper } from '@/lib/tribunal-scrapers/tjdft';

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const tribunal = arg('--tribunal');
  const desde = arg('--desde');
  if (!tribunal || !desde) throw new Error('Informe --tribunal trf5|tjdft e --desde AAAA-MM-DD');
  const scraper = { trf5: trf5Scraper, tjdft: tjdftScraper }[tribunal];
  if (!scraper) throw new Error(`Tribunal desconhecido: ${tribunal}`);

  definirOrcamentoIA(100_000);
  const r = await scraper.scrape({ desde: new Date(`${desde}T00:00:00Z`), maxItems: 100_000, tempoMaxMs: Infinity });
  console.log(JSON.stringify({ ...r, errors: r.errors.slice(0, 10) }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
