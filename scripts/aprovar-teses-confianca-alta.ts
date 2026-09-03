/**
 * Aprova em lote os enunciados de teses destiladas com confiança alta.
 *
 * Contexto (09/2026): a destilação vinha produzindo ~2 teses/dia desde julho,
 * enquanto a validação manual parou em 20 enunciados (último veredito em
 * 13/08). O Daniel considera as extrações confiáveis e optou por liberar o
 * lote em vez de julgar caso a caso.
 *
 * ESCOPO DELIBERADAMENTE ESTREITO — só entram destilações:
 *   - com `atual = true` (versão corrente da tese);
 *   - com `confianca = 'alta'` (auto-declarada pelo modelo na destilação);
 *   - criadas a partir de 11/08/2026, quando o filtro por matéria
 *     (lib/tcu/tema-acordao.ts) passou a barrar assunto fora da base.
 *
 * O corte de data é o ponto importante. Antes dele a destilação selecionava por
 * volume de citação, e matéria de pessoal (aposentadoria, pensão, VPNI, vantagem
 * "opção") domina o topo desse ranking — 156 enunciados 'alta' anteriores ao
 * filtro tratam disso, que não é a matéria do site. Aprová-los publicaria
 * previdência de servidor num acervo de licitações e contratos.
 *
 * PROVENIÊNCIA: `julgadoPor` recebe uma etiqueta de lote, não um nome de pessoa.
 * O banco não deve afirmar que alguém leu cada tese contra os trechos-fonte,
 * porque não leu. A etiqueta também torna o lote reversível e reauditável:
 *
 *   UPDATE "TeseEnunciado" SET veredito = NULL, "julgadoEm" = NULL, "julgadoPor" = NULL
 *   WHERE "julgadoPor" = 'danbarral:lote-confianca-alta';
 *
 * Uso:
 *   npx tsx scripts/aprovar-teses-confianca-alta.ts              # mostra o que faria
 *   npx tsx scripts/aprovar-teses-confianca-alta.ts --executar
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

/** Data em que o filtro por matéria entrou no cron destilar-teses-tcu. */
const CORTE_FILTRO_MATERIA = '2026-08-11';
const VEREDITO = 'fiel';
const ETIQUETA_LOTE = 'danbarral:lote-confianca-alta';

const FILTRO = `
  FROM "TeseEnunciado" te
  JOIN "TeseDestilacao" td ON td.id = te."destilacaoId"
  WHERE td.atual = true
    AND td.confianca = 'alta'
    AND td."criadoEm" >= '${CORTE_FILTRO_MATERIA}'
    AND te.veredito IS NULL
`;

async function main() {
  const executar = process.argv.includes('--executar');

  const [resumo] = await prisma.$queryRawUnsafe<Array<{ enunciados: number; destilacoes: number }>>(
    `SELECT count(*)::int AS enunciados, count(DISTINCT td.id)::int AS destilacoes ${FILTRO}`,
  );

  console.log('\n=== APROVAÇÃO EM LOTE — TESES DE CONFIANÇA ALTA ===\n');
  console.log(`Corte de matéria:  destilações a partir de ${CORTE_FILTRO_MATERIA}`);
  console.log(`A aprovar:         ${resumo.enunciados} enunciados, de ${resumo.destilacoes} destilações`);
  console.log(`Veredito:          ${VEREDITO}`);
  console.log(`julgadoPor:        ${ETIQUETA_LOTE}\n`);

  if (resumo.enunciados === 0) {
    console.log('Nada a aprovar.\n');
    return;
  }

  const amostra = await prisma.$queryRawUnsafe<Array<{ chave: string; enunciado: string }>>(
    `SELECT td.chave, left(te.enunciado, 100) AS enunciado ${FILTRO}
     ORDER BY td."dossieNoVoto" DESC LIMIT 5`,
  );
  console.log('Amostra (as mais citadas no voto):');
  for (const a of amostra) console.log(`  ${a.chave}: ${a.enunciado}...`);

  const foraDoLote = await prisma.$queryRawUnsafe<Array<{ n: number }>>(`
    SELECT count(*)::int AS n
    FROM "TeseEnunciado" te
    JOIN "TeseDestilacao" td ON td.id = te."destilacaoId"
    WHERE td.atual = true AND te.veredito IS NULL
      AND NOT (td.confianca = 'alta' AND td."criadoEm" >= '${CORTE_FILTRO_MATERIA}')
  `);
  console.log(`\nFicam de fora, ainda não julgados: ${foraDoLote[0].n} enunciados`);
  console.log('  (confiança media/baixa, ou anteriores ao filtro de matéria)');

  if (!executar) {
    console.log('\nNada foi alterado. Para aplicar:');
    console.log('  npx tsx scripts/aprovar-teses-confianca-alta.ts --executar\n');
    return;
  }

  const n = await prisma.$executeRawUnsafe(`
    UPDATE "TeseEnunciado" te
    SET veredito = '${VEREDITO}', "julgadoEm" = now(), "julgadoPor" = '${ETIQUETA_LOTE}'
    FROM "TeseDestilacao" td
    WHERE td.id = te."destilacaoId"
      AND td.atual = true
      AND td.confianca = 'alta'
      AND td."criadoEm" >= '${CORTE_FILTRO_MATERIA}'
      AND te.veredito IS NULL
  `);
  console.log(`\nAprovados: ${n} enunciados.`);
  console.log(`Para reverter este lote:`);
  console.log(`  UPDATE "TeseEnunciado" SET veredito = NULL, "julgadoEm" = NULL, "julgadoPor" = NULL`);
  console.log(`  WHERE "julgadoPor" = '${ETIQUETA_LOTE}';\n`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
