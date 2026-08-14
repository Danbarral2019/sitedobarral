/**
 * Grava no banco o veredito editorial que o Daniel exportou da folha de
 * calibração.
 *
 * Sem isto o julgamento morre no chat: o schema tem `TeseEnunciado.veredito` e
 * `carregarVeredito` sabe transportá-lo para a versão seguinte por texto
 * idêntico, mas nada escrevia esses campos — então toda redestilação devolvia
 * à fila teses que ele já tinha aprovado.
 *
 * A folha julga por CARD (o acórdão), e o card mostra todas as teses daquele
 * acórdão sob um único botão. O veredito, portanto, vale para todos os
 * enunciados vigentes da destilação, e é assim que é gravado. Quando um card
 * tem mais de uma tese o script diz quantas foram marcadas, para o efeito ficar
 * visível em vez de implícito.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/importar-veredito-teses.ts --arquivo=veredito.txt --dry-run
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/importar-veredito-teses.ts --arquivo=veredito.txt
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../lib/prisma';
import { parsearVeredito } from '../lib/tcu/parsear-veredito';
import { resolverAlvoDivergencia } from '../lib/tcu/aplicar-veredito';

function flag(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1];
}

async function main() {
  const arquivo = flag('arquivo');
  const julgadoPor = flag('julgado-por') ?? 'daniel';
  const dryRun = process.argv.includes('--dry-run');

  if (!arquivo) {
    console.error('uso: --arquivo=<caminho do export da folha> [--julgado-por=daniel] [--dry-run]');
    process.exit(1);
  }

  const parsed = parsearVeredito(readFileSync(arquivo, 'utf8'));
  console.log(
    `lidos: ${parsed.casos.length} caso(s) julgado(s), ${parsed.divergencias.length} divergência(s), ` +
      `${parsed.pendentes} pendente(s) ignorado(s)`
  );
  for (const linha of parsed.invalidas) console.log(`⚠️ linha não reconhecida, ignorada: ${linha}`);
  if (dryRun) console.log('🧪 --dry-run: nada será gravado\n');

  const chaves = [...new Set([...parsed.casos, ...parsed.divergencias].map((v) => v.chave))];
  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { chave: { in: chaves }, atual: true },
    include: {
      enunciados: { orderBy: { ordem: 'asc' } },
      divergencias: { orderBy: { ordem: 'asc' } },
    },
  });
  const porChave = new Map(destilacoes.map((d) => [d.chave, d]));

  const agora = new Date();
  let enunciadosGravados = 0;
  let enunciadosInalterados = 0;
  let enunciadosMudados = 0;
  let divergenciasGravadas = 0;
  const semDestilacao: string[] = [];
  const recusadas: string[] = [];

  for (const caso of parsed.casos) {
    const d = porChave.get(caso.chave);
    if (!d) {
      semDestilacao.push(caso.chave);
      continue;
    }
    if (d.enunciados.length === 0) {
      recusadas.push(`${caso.chave}: destilação vigente sem enunciado (o motor se calou) — nada a marcar`);
      continue;
    }

    // Os três grupos são disjuntos e cobrem os enunciados da destilação.
    const novos = d.enunciados.filter((e) => e.veredito === null);
    const iguais = d.enunciados.filter((e) => e.veredito !== null && e.veredito === caso.veredito);
    const mudam = d.enunciados.filter((e) => e.veredito !== null && e.veredito !== caso.veredito);
    for (const e of mudam) {
      console.log(`⚠️ ${caso.chave}: enunciado ${e.ordem} muda de "${e.veredito}" para "${caso.veredito}"`);
    }

    if (!dryRun) {
      await prisma.teseEnunciado.updateMany({
        where: { destilacaoId: d.id },
        data: { veredito: caso.veredito, julgadoEm: agora, julgadoPor, herdadoDe: null },
      });
    }
    enunciadosGravados += novos.length;
    enunciadosInalterados += iguais.length;
    enunciadosMudados += mudam.length;
    const nota = d.enunciados.length > 1 ? ` (${d.enunciados.length} teses no card)` : '';
    console.log(`  ${caso.chave}: ${caso.veredito}${nota}`);
  }

  for (const div of parsed.divergencias) {
    const d = porChave.get(div.chave);
    if (!d) {
      semDestilacao.push(div.chave);
      continue;
    }
    const alvo = resolverAlvoDivergencia(div.indice, d.divergencias);
    if ('recusa' in alvo) {
      recusadas.push(`${div.chave} / divergência ${div.indice + 1}: ${alvo.recusa}`);
      continue;
    }
    if (!dryRun) {
      await prisma.teseDivergencia.update({
        where: { id: alvo.id },
        data: { veredito: div.veredito, julgadoEm: agora, julgadoPor, herdadoDe: null },
      });
    }
    divergenciasGravadas++;
    console.log(`  ${div.chave} / divergência ${div.indice + 1}: ${div.veredito}`);
  }

  console.log('\n─── resumo ───');
  console.log(`enunciados marcados : ${enunciadosGravados + enunciadosInalterados + enunciadosMudados}`);
  console.log(`  sem veredito antes: ${enunciadosGravados}`);
  console.log(`  já tinham o mesmo : ${enunciadosInalterados}`);
  console.log(`  veredito alterado : ${enunciadosMudados}`);
  console.log(`divergências marcadas: ${divergenciasGravadas}`);
  if (semDestilacao.length) {
    console.log(`\n⚠️ sem destilação vigente (${semDestilacao.length}): ${[...new Set(semDestilacao)].join(', ')}`);
  }
  if (recusadas.length) {
    console.log(`\n⚠️ NÃO gravadas (${recusadas.length}) — precisam de decisão humana:`);
    for (const r of recusadas) console.log(`   ${r}`);
  }
  if (dryRun) console.log('\n🧪 --dry-run: nada foi gravado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
