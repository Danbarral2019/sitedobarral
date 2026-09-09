/**
 * Recupera o julgamento editorial perdido nas redestilações anteriores à
 * herança de nível 2 (spec §7).
 *
 * Dois movimentos, e a diferença entre eles importa: o primeiro DEVOLVE teses
 * ao acervo restrito; o segundo não muda o que está no ar, apenas torna visível
 * que um veredito de lote está sentado sobre uma conferência individual
 * anterior. O relatório os separa por isso.
 *
 * Uso:
 *   npx tsx scripts/backfill-heranca-editorial.ts               # dry-run
 *   npx tsx scripts/backfill-heranca-editorial.ts --executar
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { planejarBackfill, type GrupoDeVersoes } from '../lib/tcu/backfill-heranca';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const SELECT_ENUNCIADO = {
  id: true, enunciado: true, veredito: true, julgadoEm: true, julgadoPor: true,
  publicado: true, vitrinePublica: true, retiradoEm: true, retiradoMotivo: true,
} as const;

async function montarGrupos(): Promise<GrupoDeVersoes[]> {
  const destilacoes = await prisma.teseDestilacao.findMany({
    orderBy: { criadoEm: 'asc' },
    select: {
      id: true, numeroAlvo: true, anoAlvo: true, atual: true, criadoEm: true,
      enunciados: { select: SELECT_ENUNCIADO },
    },
  });

  // Pareamento por VERSÃO (spec §4.2): a vigente com a imediatamente anterior
  // do mesmo alvo. Nunca enunciado a enunciado.
  const porAlvo = new Map<string, typeof destilacoes>();
  for (const d of destilacoes) {
    const chave = `${d.numeroAlvo}/${d.anoAlvo}`;
    porAlvo.set(chave, [...(porAlvo.get(chave) ?? []), d]);
  }

  const grupos: GrupoDeVersoes[] = [];
  for (const versoes of porAlvo.values()) {
    const vigente = versoes.find((v) => v.atual);
    const anterior = versoes.filter((v) => !v.atual).at(-1);
    if (!vigente || !anterior) continue;
    grupos.push({
      vigentes: vigente.enunciados.map((e) => ({ id: e.id, enunciado: e.enunciado, veredito: e.veredito })),
      anteriores: anterior.enunciados,
    });
  }
  return grupos;
}

async function main() {
  const executar = process.argv.includes('--executar');

  console.log('\n=== BACKFILL DA HERANÇA EDITORIAL ===\n');

  const grupos = await montarGrupos();
  console.log(`Alvos com versão anterior: ${grupos.length}`);

  const { herdar, marcar } = planejarBackfill(grupos);

  console.log(`\n1º movimento — voltam ao acervo restrito: ${herdar.length} enunciado(s)`);
  console.log(`2º movimento — só ganham a marca de pendência: ${marcar.length} enunciado(s)`);
  console.log('   (o 2º não muda o que está no ar; torna visível o veredito de lote sobre conferência anterior)');

  if (!executar) {
    console.log('\nModo: dry-run (nada será gravado)');
    console.log('Para aplicar: --executar\n');
    return;
  }

  console.log('\nModo: EXECUTAR');

  for (const h of herdar) {
    await prisma.teseEnunciado.update({
      where: { id: h.enunciadoId },
      data: {
        veredito: h.veredito,
        publicado: h.publicado,
        herdadoDe: h.herdadoDe,
        vitrinePublica: false,
        julgadoEm: null,
        julgadoPor: null,
        reconferenciaPendente: true,
      },
    });
  }

  const marcados = await prisma.teseEnunciado.updateMany({
    where: { id: { in: marcar } },
    data: { reconferenciaPendente: true },
  });

  console.log(`\nHerdados: ${herdar.length} · Marcados: ${marcados.count}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
