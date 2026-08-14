/**
 * Preenche `TeseDivergencia.ordem` nas divergências gravadas antes do campo
 * existir.
 *
 * A ordem original delas não foi persistida — `persistirDestilacao` criava as
 * linhas na ordem do array devolvido pelo motor, mas nada registrava a posição.
 * A melhor reconstrução disponível é o `id`: o cuid é monotônico crescente e as
 * linhas foram criadas num único `create` aninhado, na ordem do array. É uma
 * reconstrução, não um dado recuperado, e é o motivo de rodar isto UMA vez,
 * antes de qualquer folha nova ser gerada — a partir daí `ordem` é gravada
 * explicitamente na criação e o problema não se repete.
 *
 * Idempotente por construção: reordenar pelo mesmo critério dá o mesmo
 * resultado. Não altera veredito nenhum.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-ordem-divergencias.ts --dry-run
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-ordem-divergencias.ts
 */
import { prisma } from '../lib/prisma';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { divergencias: { some: {} } },
    select: {
      chave: true,
      atual: true,
      divergencias: { select: { id: true, ordem: true, veredito: true }, orderBy: { id: 'asc' } },
    },
  });

  let linhas = 0;
  let mudanças = 0;
  let comVeredito = 0;

  for (const d of destilacoes) {
    for (let i = 0; i < d.divergencias.length; i++) {
      const div = d.divergencias[i];
      linhas++;
      if (div.veredito !== null) comVeredito++;
      if (div.ordem === i) continue;
      mudanças++;
      if (!dryRun) {
        await prisma.teseDivergencia.update({ where: { id: div.id }, data: { ordem: i } });
      }
    }
  }

  console.log(`destilações com divergência: ${destilacoes.length}`);
  console.log(`linhas visitadas           : ${linhas}`);
  console.log(`ordem ajustada             : ${mudanças}`);
  console.log(`já julgadas (veredito != null, intocadas): ${comVeredito}`);
  if (dryRun) console.log('\n🧪 --dry-run: nada foi gravado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
