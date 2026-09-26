/**
 * Backfill: grava o inteiro teor das deliberações do TCE-PE que já estão na base.
 *
 * Contexto (26/09/2026): o scraper extraía o inteiro teor (`descricaoParecerProcesso`),
 * usava-o na classificação e no resumo e o descartava; a "ementa" gravada é só um
 * recorte de 2.000 caracteres dele. O scraper já foi corrigido para as inclusões
 * futuras; este script cobre o passivo.
 *
 * Grava SÓ `fullText`. Não reclassifica, não gera resumo, não mexe em
 * `embeddingStatus`: o inteiro teor do TCE-PE é para leitura na página e não entra
 * no embedding (ver `indexaTextoIntegral` em lib/embeddings/tribunal-decision-processor.ts).
 *
 * A API do TCE-PE ignora filtro por número, então o script pagina a listagem
 * (mais recentes primeiro) até passar da data da deliberação mais antiga da base.
 * Idempotente: só toca linhas com `fullText` nulo.
 *
 * Uso:
 *   npx tsx scripts/backfill-tce-pe-inteiro-teor.ts              # simulação (padrão): conta, não grava
 *   npx tsx scripts/backfill-tce-pe-inteiro-teor.ts --executar
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { tcePEScraper } from '../lib/tribunal-scrapers/tce-pe';
import { buildFullIdentifier, normalizeDecisionNumber, sleep } from '../lib/tribunal-scrapers/utils';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

/** Teto de páginas de 200 itens, para o laço nunca varrer os ~60 mil da API. */
const MAX_PAGINAS = 120;
const PAUSA_MS = 1000;

async function main() {
  const executar = process.argv.includes('--executar');

  const pendentes = await prisma.tribunalDecision.findMany({
    where: { tribunalCode: 'TCE-PE', decisionType: 'acordao', fullText: null },
    select: { fullIdentifier: true, dataJulgamento: true },
  });
  if (pendentes.length === 0) {
    console.log('Nada a fazer: todas as deliberações do TCE-PE já têm inteiro teor.');
    return;
  }
  const faltam = new Set(pendentes.map((p) => p.fullIdentifier));
  const datas = pendentes.map((p) => p.dataJulgamento?.getTime()).filter((t): t is number => !!t);
  const maisAntiga = datas.length ? new Date(Math.min(...datas)) : null;
  console.log(`Pendentes: ${faltam.size}. Deliberação mais antiga: ${maisAntiga?.toISOString().slice(0, 10) ?? 'sem data'}.`);
  console.log(executar ? 'Modo: EXECUTAR (grava fullText).' : 'Modo: simulação (nada é gravado).');

  let gravados = 0;
  let semTexto = 0;
  for (let pagina = 0; pagina < MAX_PAGINAS && faltam.size > 0; pagina++) {
    const itens = await tcePEScraper.fetchDeliberacoes(pagina);
    if (itens.length === 0) break;

    for (const item of itens) {
      const raw = tcePEScraper.deliberacaoToDecision(item);
      const id = buildFullIdentifier('tce-pe', 'acordao', normalizeDecisionNumber(raw.decisionNumber));
      if (!faltam.has(id)) continue;
      const texto = raw.inteiroTeor || raw.fullText;
      if (!texto) {
        semTexto++;
        faltam.delete(id);
        continue;
      }
      if (executar) {
        await prisma.tribunalDecision.updateMany({ where: { fullIdentifier: id, fullText: null }, data: { fullText: texto } });
      }
      gravados++;
      faltam.delete(id);
    }

    const ultima = itens[itens.length - 1]?.dataJulgamentoProcesso;
    console.log(`Página ${pagina}: ${gravados} ${executar ? 'gravados' : 'a gravar'}, ${faltam.size} pendentes (última data ${ultima?.slice(0, 10) ?? '?'}).`);
    if (maisAntiga && ultima && new Date(ultima) < new Date(maisAntiga.getTime() - 86_400_000)) break;
    await sleep(PAUSA_MS);
  }

  console.log(`\nFim. ${executar ? 'Gravados' : 'A gravar'}: ${gravados}. Sem texto na fonte: ${semTexto}. Não encontrados na listagem: ${faltam.size}.`);
  if (faltam.size > 0) console.log('Não encontrados (até 10):', [...faltam].slice(0, 10).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
