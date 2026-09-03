/**
 * Cria os índices HNSW das tabelas de chunks (pgvector).
 *
 * Contexto (09/2026): descoberto ao medir a busca depois do backfill de inteiro
 * teor — NENHUMA das três tabelas de chunks tem índice vetorial. Toda busca
 * semântica faz Parallel Seq Scan, comparando a pergunta contra todos os chunks.
 * Passava despercebido com 2 mil chunks; com 55 mil, uma consulta de similaridade
 * leva ~350 ms, e a busca híbrida roda vários ramos por pergunta.
 *
 * A spec de 07/2026 (fase4-embedding-dim-ab-design §3) deixou isso como pergunta
 * em aberto — "a verificar se produção usa ivfflat/hnsw ou scan exato". A medição
 * respondeu: scan exato, nunca houve índice.
 *
 * QUANDO RODAR: depois que a fila de embeddings drenar (o cron process-index-jobs
 * ainda está indexando acórdãos). Construir o índice agora significa reconstruir
 * depois — o HNSW acomoda inserções, mas um build sobre a base completa fica
 * melhor distribuído.
 *
 * Uso:
 *   npx tsx scripts/criar-indice-vetorial.ts                    # diagnóstico, não altera nada
 *   npx tsx scripts/criar-indice-vetorial.ts --executar         # cria os índices faltantes
 *   npx tsx scripts/criar-indice-vetorial.ts --executar --tabela DocumentChunk
 *
 * ATENÇÃO — o que muda em produção:
 *  - HNSW é busca APROXIMADA. Hoje a busca é exata (scan). O recall pode variar
 *    ligeiramente; `hnsw.ef_search` (default 40) controla o trade-off e pode ser
 *    elevado por sessão se o eval acusar perda. Vale re-rodar `npm run eval:run`
 *    depois e comparar com o baseline do ROADMAP_BUSCA_QUALIDADE.md.
 *  - O build é pesado (minutos por tabela) e consome memória. Usa CONCURRENTLY,
 *    então NÃO bloqueia leitura nem escrita — pode rodar com o site no ar.
 *  - CONCURRENTLY não roda dentro de transação; se falhar, deixa um índice
 *    INVALID que precisa de DROP antes de tentar de novo (o diagnóstico avisa).
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

/**
 * Todas as buscas usam `<=>` (distância de cosseno) — ver vector-search.ts nos
 * três ramos e legal-context.ts. A operator class TEM que casar com o operador,
 * senão o planner ignora o índice em silêncio e nada muda.
 */
const OPERATOR_CLASS = 'vector_cosine_ops';

/**
 * m=16 / ef_construction=64 são os defaults do pgvector: bom equilíbrio entre
 * tempo de build e recall para bases desta ordem (dezenas de milhares).
 * Aumentar m melhora o recall e encarece memória; não há motivo para desviar
 * do default antes de medir.
 */
const M = 16;
const EF_CONSTRUCTION = 64;

const TABELAS = ['DocumentChunk', 'LegislativeActChunk', 'TribunalDecisionChunk'] as const;

interface Estado {
  tabela: string;
  linhas: number;
  temIndice: boolean;
  indiceInvalido: boolean;
}

async function diagnosticar(): Promise<Estado[]> {
  const estados: Estado[] = [];
  for (const tabela of TABELAS) {
    const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM "${tabela}"`,
    );
    const idx = await prisma.$queryRawUnsafe<Array<{ nome: string; valido: boolean }>>(`
      SELECT c.relname::text AS nome, i.indisvalid AS valido
      FROM pg_class c
      JOIN pg_index i ON i.indexrelid = c.oid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_am am ON am.oid = c.relam
      WHERE t.relname = '${tabela}' AND am.amname = 'hnsw'
    `);
    estados.push({
      tabela,
      linhas: n,
      temIndice: idx.some(i => i.valido),
      indiceInvalido: idx.some(i => !i.valido),
    });
  }
  return estados;
}

/** Mede o custo real de uma busca de similaridade, com o plano escolhido. */
async function medir(tabela: string): Promise<{ ms: number; plano: string } | null> {
  const sonda = await prisma.$queryRawUnsafe<Array<{ v: string }>>(
    `SELECT embedding::text AS v FROM "${tabela}" LIMIT 1`,
  );
  if (sonda.length === 0) return null;

  const t0 = Date.now();
  await prisma.$queryRawUnsafe(
    `SELECT id FROM "${tabela}" ORDER BY embedding <=> '${sonda[0].v}'::vector LIMIT 10`,
  );
  const ms = Date.now() - t0;

  const plano = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
    `EXPLAIN SELECT id FROM "${tabela}" ORDER BY embedding <=> '${sonda[0].v}'::vector LIMIT 10`,
  );
  const linhas = plano.map(l => String(Object.values(l)[0]));
  const scan = linhas.find(l => l.includes('Scan')) ?? linhas[0] ?? '';
  return { ms, plano: scan.trim() };
}

function sqlCriacao(tabela: string): string {
  return (
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${tabela}_embedding_hnsw_idx" ` +
    `ON "${tabela}" USING hnsw (embedding ${OPERATOR_CLASS}) ` +
    `WITH (m = ${M}, ef_construction = ${EF_CONSTRUCTION})`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const executar = args.includes('--executar');
  const iTabela = args.indexOf('--tabela');
  const filtro = iTabela >= 0 ? args[iTabela + 1] : undefined;

  const estados = (await diagnosticar()).filter(e => !filtro || e.tabela === filtro);

  console.log('\n=== ÍNDICES VETORIAIS (pgvector / HNSW) ===\n');
  for (const e of estados) {
    const medicao = await medir(e.tabela);
    const situacao = e.temIndice ? 'HNSW presente' : e.indiceInvalido ? 'ÍNDICE INVÁLIDO' : 'SEM ÍNDICE';
    console.log(`${e.tabela}`);
    console.log(`  linhas:    ${e.linhas.toLocaleString('pt-BR')}`);
    console.log(`  situação:  ${situacao}`);
    if (medicao) {
      console.log(`  consulta:  ${medicao.ms} ms`);
      console.log(`  plano:     ${medicao.plano}`);
    }
    if (e.indiceInvalido) {
      console.log(`  ⚠️  Um build anterior falhou. Rode antes:`);
      console.log(`      DROP INDEX CONCURRENTLY "${e.tabela}_embedding_hnsw_idx";`);
    }
    console.log('');
  }

  const pendentes = estados.filter(e => !e.temIndice && !e.indiceInvalido && e.linhas > 0);

  if (pendentes.length === 0) {
    console.log('Nada a criar.\n');
    return;
  }

  if (!executar) {
    console.log('SQL que seria executado (nada foi alterado):\n');
    for (const e of pendentes) console.log(`  ${sqlCriacao(e.tabela)};\n`);
    console.log('Para aplicar:  npx tsx scripts/criar-indice-vetorial.ts --executar\n');
    return;
  }

  // Acelera o build; o default do Neon é baixo demais para HNSW.
  await prisma.$executeRawUnsafe(`SET maintenance_work_mem = '512MB'`);

  for (const e of pendentes) {
    console.log(`Criando índice em ${e.tabela} (${e.linhas.toLocaleString('pt-BR')} linhas)...`);
    const t0 = Date.now();
    try {
      await prisma.$executeRawUnsafe(sqlCriacao(e.tabela));
      console.log(`  pronto em ${((Date.now() - t0) / 60000).toFixed(1)} min`);
      const depois = await medir(e.tabela);
      if (depois) console.log(`  consulta agora: ${depois.ms} ms — ${depois.plano}`);
    } catch (err) {
      console.error(`  FALHOU: ${(err as Error).message.slice(0, 200)}`);
      console.error(`  Verifique índice INVALID com o diagnóstico antes de repetir.`);
    }
    console.log('');
  }

  console.log('Próximo passo: rodar `npm run eval:run` e comparar recall@5 com o');
  console.log('baseline do ROADMAP_BUSCA_QUALIDADE.md — HNSW é aproximado.\n');
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
