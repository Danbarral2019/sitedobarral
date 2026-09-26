/**
 * Passivo: promove a acervo público os acórdãos do grafo cujo inteiro teor cita
 * lei de licitações e contratos (regra em lib/tcu/publicacao-grafo.ts; decisão do
 * Daniel em 26/09/2026). Os acórdãos que chegarem depois são promovidos na
 * catalogação do inteiro teor (lib/tcu/catalogar-acordao.ts), com a mesma regra.
 *
 * Fica de fora: acórdão sem inteiro teor (entra quando for catalogado) e acórdão
 * com a mesma URL de um acórdão curado (duplicata).
 *
 * Segue o workflow de inclusão de documentos: valida uma amostra das URLs antes
 * de gravar, marca isPublic e isCommon, mantém os embeddings existentes.
 *
 * Uso:
 *   npx tsx scripts/promover-grafo-licitacao.ts              # simulação (padrão)
 *   npx tsx scripts/promover-grafo-licitacao.ts --executar
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { CATEGORIA_GRAFO } from '../lib/tcu/backfill-retroativo';
import { CATEGORIAS_CURADAS_TCU, PADRAO_LEI_DE_LICITACAO, dadosDePromocao } from '../lib/tcu/publicacao-grafo';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const AMOSTRA_URLS = 8;

interface Candidato {
  id: string;
  title: string;
  url: string;
  tags: string | null;
  inicio: string;
}

async function validarUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    return `${r.status}`;
  } catch (e) {
    return `erro: ${(e as Error).message.slice(0, 60)}`;
  }
}

async function main() {
  const executar = process.argv.includes('--executar');

  const candidatos = await prisma.$queryRaw<Candidato[]>`
    SELECT d.id, d.title, d.url, d.tags, split_part(d.description, '.', 1) AS inicio
    FROM "Document" d
    WHERE d.category = ${CATEGORIA_GRAFO}
      AND d."tcuTextoCompleto" ~* ${PADRAO_LEI_DE_LICITACAO}
      AND NOT EXISTS (
        SELECT 1 FROM "Document" c
        WHERE c.url = d.url AND c.category = ANY(${[...CATEGORIAS_CURADAS_TCU]}::text[]) AND c.id <> d.id
      )
    ORDER BY d."tcuDataJulgamento" DESC NULLS LAST`;

  const [{ total, sem_teor }] = await prisma.$queryRaw<{ total: number; sem_teor: number }[]>`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE "tcuTextoCompleto" IS NULL)::int AS sem_teor
    FROM "Document" WHERE category = ${CATEGORIA_GRAFO}`;

  console.log(`Grafo: ${total} acórdãos (${sem_teor} ainda sem inteiro teor).`);
  console.log(`A promover: ${candidatos.length}.`);

  const porInicio = new Map<string, number>();
  for (const c of candidatos) porInicio.set(c.inicio, (porInicio.get(c.inicio) ?? 0) + 1);
  console.log('\nNatureza (início da ementa), 12 mais frequentes:');
  for (const [k, n] of [...porInicio].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(n).padStart(5)}  ${k}`);

  console.log(`\nValidação de URL (amostra de ${AMOSTRA_URLS}):`);
  const passo = Math.max(1, Math.floor(candidatos.length / AMOSTRA_URLS));
  let urlsRuins = 0;
  for (let i = 0; i < candidatos.length && i / passo < AMOSTRA_URLS; i += passo) {
    const st = await validarUrl(candidatos[i].url);
    if (st !== '200') urlsRuins++;
    console.log(`  ${st}  ${candidatos[i].title}`);
  }
  if (urlsRuins > 0) {
    console.log(`\n${urlsRuins} URL(s) da amostra não responderam 200. Nada foi gravado; confira antes de executar.`);
    return;
  }

  if (!executar) {
    console.log('\nSimulação: nada foi gravado. Rode com --executar para promover.');
    return;
  }

  let feitos = 0;
  for (const c of candidatos) {
    // Revalida a condição na escrita: só sai do grafo o que ainda está no grafo.
    await prisma.document.updateMany({ where: { id: c.id, category: CATEGORIA_GRAFO }, data: dadosDePromocao(c.tags) });
    feitos++;
    if (feitos % 200 === 0) console.log(`  ${feitos}/${candidatos.length}`);
  }
  console.log(`\nPromovidos: ${feitos}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
