/**
 * Promove à vitrine pública as teses conferidas individualmente (spec §10.2).
 *
 * A vitrine é o recorte PÚBLICO do acervo, e por isso exige duas coisas que o
 * acervo restrito não exige:
 *
 *   1. conferência individual — veredito com nome de pessoa, não etiqueta de
 *      lote. `julgadoPor` contendo ':lote-' marca aprovação em massa por
 *      confiança auto-declarada pelo modelo, que não basta para o público;
 *   2. identidade oficial do TCU (nível 1, `acordaoKey` preenchida). A URL
 *      pública afirma o colegiado no próprio endereço — `/teses/96-2008-plenario`
 *      —, então convergência dos citantes (nível 2) e "sem colegiado" (nível 3)
 *      valem para acervo, busca e ELIC, mas não aqui (spec §4.3).
 *
 * A intersecção das duas costuma ser bem menor do que a contagem de qualquer
 * uma delas isolada; o dry-run mostra o que ficou de fora e por quê.
 *
 * Reversível: `--despromover` tira da vitrine sem tocar no acervo.
 *
 * Uso:
 *   npx tsx scripts/promover-vitrine-teses.ts               # dry-run
 *   npx tsx scripts/promover-vitrine-teses.ts --executar
 *   npx tsx scripts/promover-vitrine-teses.ts --despromover --executar
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { WHERE_ELEGIVEL_VITRINE, evidenciaIntegral } from '../lib/tcu/elegibilidade-tese';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const ETIQUETA_DE_LOTE = ':lote-';

async function selecionar() {
  const candidatos = await prisma.teseEnunciado.findMany({
    where: {
      ...WHERE_ELEGIVEL_VITRINE,
      publicado: true,
      vitrinePublica: false,
      julgadoPor: { not: null },
    },
    select: {
      id: true,
      enunciado: true,
      julgadoPor: true,
      trechosFonte: true,
      trechos: {
        select: { ordem: true, origemDocumentId: true, origemUrl: true, origemLinkPDF: true },
      },
      destilacao: { select: { numeroAlvo: true, anoAlvo: true, colegiadoAlvo: true } },
    },
  });

  const promoviveis = candidatos.filter(
    (c) =>
      !c.julgadoPor!.includes(ETIQUETA_DE_LOTE) &&
      evidenciaIntegral({ trechosFonte: c.trechosFonte, trechos: c.trechos }),
  );

  const foraPorLote = candidatos.filter((c) => c.julgadoPor!.includes(ETIQUETA_DE_LOTE)).length;

  return { promoviveis, foraPorLote };
}

async function main() {
  const executar = process.argv.includes('--executar');
  const despromover = process.argv.includes('--despromover');

  if (despromover) {
    const alvos = await prisma.teseEnunciado.findMany({
      where: { vitrinePublica: true },
      select: { id: true },
    });
    console.log(`\nA retirar da vitrine: ${alvos.length} enunciados`);
    console.log('(o acervo restrito não é tocado)');
    if (!executar) {
      console.log('\nDry-run. Para aplicar: --executar\n');
      return;
    }
    const r = await prisma.teseEnunciado.updateMany({
      where: { id: { in: alvos.map((a) => a.id) } },
      data: { vitrinePublica: false },
    });
    console.log(`\nRetirados da vitrine: ${r.count}\n`);
    return;
  }

  console.log('\n=== PROMOÇÃO À VITRINE PÚBLICA ===\n');

  const { promoviveis, foraPorLote } = await selecionar();

  console.log(`Conferidos individualmente e elegíveis à vitrine: ${promoviveis.length}\n`);
  for (const p of promoviveis) {
    const d = p.destilacao;
    console.log(`  Acórdão ${d.numeroAlvo}/${d.anoAlvo} — ${d.colegiadoAlvo ?? 'sem colegiado'}`);
    console.log(`    conferido por: ${p.julgadoPor}`);
    console.log(`    "${p.enunciado.slice(0, 100)}${p.enunciado.length > 100 ? '...' : ''}"`);
  }

  console.log(`\nFicaram de fora:`);
  console.log(`  aprovados apenas em lote (sem conferência individual): ${foraPorLote}`);

  if (!executar) {
    console.log('\nModo: dry-run (nada será gravado)');
    console.log('Para aplicar: --executar\n');
    return;
  }

  console.log('\nModo: EXECUTAR');
  const r = await prisma.teseEnunciado.updateMany({
    where: { id: { in: promoviveis.map((p) => p.id) } },
    data: { vitrinePublica: true },
  });
  console.log(`\nPromovidos à vitrine: ${r.count}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
