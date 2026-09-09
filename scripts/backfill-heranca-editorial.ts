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
  // Mesmo par que `persistir-tese.ts` seleciona: sem eles `carregarVeredito`
  // não reconhece um antecessor provisório e perde o rastro do julgamento.
  herdadoDe: true, reconferenciaPendente: true,
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
      chave: `${vigente.numeroAlvo}/${vigente.anoAlvo}`,
      vigentes: vigente.enunciados.map((e) => ({
        id: e.id,
        enunciado: e.enunciado,
        veredito: e.veredito,
        // `julgadoPor` do VIGENTE: sem ele o plano marcaria pendência sobre o
        // que uma pessoa acabou de conferir.
        julgadoPor: e.julgadoPor,
      })),
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

  // Contagens não deixam conferir nada, e este script roda uma vez só, contra
  // produção: o dry-run é o único pré-voo do operador. Listar chave e id é o
  // que permite abrir a folha e olhar o acórdão antes de aplicar.
  console.log(`\n1º movimento — voltam ao acervo restrito: ${herdar.length} enunciado(s)`);
  for (const h of herdar) {
    console.log(`   Acórdão ${h.chave} · ${h.enunciadoId} · veredito ${h.veredito}` +
      `${h.publicado ? ' · publicado' : ''} · herda de ${h.herdadoDe}`);
  }

  console.log(`\n2º movimento — só ganham a marca de pendência: ${marcar.length} enunciado(s)`);
  console.log('   (o 2º não muda o que está no ar; torna visível o veredito de lote sobre conferência anterior)');
  for (const m of marcar) {
    console.log(`   Acórdão ${m.chave} · ${m.enunciadoId} · herda de ${m.herdadoDe}`);
  }

  if (!executar) {
    console.log('\nModo: dry-run (nada será gravado)');
    console.log('Para aplicar: --executar\n');
    return;
  }

  console.log('\nModo: EXECUTAR');

  // Tudo numa transação só: uma falha no meio deixava metade do primeiro
  // movimento aplicada, sem forma barata de descobrir onde parou — e o segundo
  // movimento agora grava linha a linha (cada uma com o seu `herdadoDe`),
  // então não há mais um `updateMany` que sirva de âncora.
  await prisma.$transaction([
    ...herdar.map((h) =>
      prisma.teseEnunciado.update({
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
      })
    ),
    ...marcar.map((m) =>
      prisma.teseEnunciado.update({
        where: { id: m.enunciadoId },
        // `herdadoDe` junto da marca: a fila da folha descarta em silêncio a
        // pendência que não aponta para o enunciado aprovado.
        data: { reconferenciaPendente: true, herdadoDe: m.herdadoDe },
      })
    ),
  ]);

  console.log(`\nHerdados: ${herdar.length} · Marcados: ${marcar.length}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
