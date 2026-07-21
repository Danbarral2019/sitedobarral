/**
 * Status da campanha de ingestão retroativa de acórdãos do TCU (onda W2).
 *
 * Serve para acompanhar a campanha sem depender de sessão: mostra onde o
 * cursor está, quanto falta na fila de catalogação e como anda o grafo.
 *
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/status-campanha-tcu.ts
 *
 * A campanha termina quando `concluido` vira true no cursor (a data da sessão
 * cruza 2023-12-01) E a fila de catalogação zera. Aí as frequências dos crons
 * `catalog-tcu-inteiro-teor` e `backfill-tcu-retroativo` devem voltar ao ritmo
 * diário no `vercel.json` — deixá-las aceleradas depois do fim é queimar
 * execução de função à toa.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CATEGORIAS_ACORDAO } from '../lib/tcu/categorias';
import { CATEGORIA_GRAFO } from '../lib/tcu/backfill-retroativo';

const pct = (n: number, d: number) => (d === 0 ? '0%' : `${((n / d) * 100).toFixed(1)}%`);

async function main() {
  const cursor = await prisma.backfillCursor.findUnique({ where: { id: 'tcu-retroativo' } });

  const [naFila, catalogados, desistidos, ingeridos] = await Promise.all([
    prisma.document.count({
      where: {
        category: { in: [...CATEGORIAS_ACORDAO] },
        tcuLinkPDF: { not: null },
        tcuAnalise: { equals: Prisma.DbNull },
        tcuAnaliseTentativas: { lt: 3 },
      },
    }),
    prisma.document.count({
      where: { category: { in: [...CATEGORIAS_ACORDAO] }, tcuAnalise: { not: null } },
    }),
    prisma.document.count({
      where: {
        category: { in: [...CATEGORIAS_ACORDAO] },
        tcuAnalise: { equals: Prisma.DbNull },
        tcuAnaliseTentativas: { gte: 3 },
      },
    }),
    prisma.document.count({ where: { category: CATEGORIA_GRAFO } }),
  ]);

  const arestas = await prisma.acordaoCitacao.count();
  const noVoto = await prisma.acordaoCitacao.count({ where: { noVoto: true } });

  const faixa = await prisma.$queryRaw<Array<{ faixa: string; casos: bigint }>>`
    WITH v AS (
      SELECT "numeroAlvo", "anoAlvo",
             count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int nv
      FROM "AcordaoCitacao" GROUP BY 1, 2)
    SELECT CASE WHEN nv >= 20 THEN 'A: >=20'
                WHEN nv >= 10 THEN 'B: 10-19'
                WHEN nv >= 5  THEN 'C: 5-9'
                WHEN nv >= 2  THEN 'D: 2-4'
                ELSE 'E: <2' END AS faixa,
           count(*) AS casos
    FROM v GROUP BY 1 ORDER BY 1`;

  console.log('\n=== CAMPANHA DE INGESTÃO RETROATIVA DO TCU ===\n');
  console.log('CURSOR NO FEED');
  console.log(`  posição:        ${cursor?.offset ?? 0}`);
  console.log(`  chegou até:     ${cursor?.ultimaData ?? '—'} (${cursor?.ultimoAcordao ?? '—'})`);
  console.log(`  alvo:           01/12/2023`);
  console.log(`  concluído:      ${cursor?.concluido ? 'SIM' : 'não'}`);
  console.log(`  ingeridos:      ${cursor?.totalInserido ?? 0}  |  descartados: ${cursor?.totalIgnorado ?? 0}`);

  console.log('\nFILA DE CATALOGAÇÃO (baixar inteiro teor)');
  console.log(`  na fila:        ${naFila}`);
  console.log(`  catalogados:    ${catalogados}`);
  console.log(`  desistidos:     ${desistidos} (3 tentativas falhas)`);
  console.log(`  combustível:    ${ingeridos} documentos com category='${CATEGORIA_GRAFO}'`);

  console.log('\nGRAFO DE PRECEDENTES');
  console.log(`  arestas:        ${arestas}`);
  console.log(`  no voto:        ${noVoto} (${pct(noVoto, arestas)})`);

  console.log('\nLEADING CASES POR FAIXA DE CITAÇÕES NO VOTO');
  let aproveitaveis = 0;
  for (const f of faixa) {
    const n = Number(f.casos);
    if (f.faixa.startsWith('A') || f.faixa.startsWith('B') || f.faixa.startsWith('C')) aproveitaveis += n;
    console.log(`  ${f.faixa.padEnd(10)} ${n}`);
  }
  console.log(`\n  FAIXA APROVEITÁVEL (>=5 no voto): ${aproveitaveis} casos`);
  console.log('  (referência: 126 ao fim da onda W1, em 21/07/2026)\n');

  if (cursor?.concluido && naFila === 0) {
    console.log('🏁 CAMPANHA CONCLUÍDA — reverter os schedules no vercel.json para o ritmo diário.\n');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
