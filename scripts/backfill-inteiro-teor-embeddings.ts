/**
 * Backfill: reindexa os acórdãos do TCU usando o INTEIRO TEOR.
 *
 * Contexto (09/2026): `catalog-tcu-inteiro-teor` já baixou o inteiro teor de
 * ~1.8 mil acórdãos (média ~68 mil chars), mas o texto nunca chegou ao índice —
 * `selectSourceText` não o listava como candidato e `catalogar-acordao` não
 * reenfileirava o documento. Resultado: 1 chunk de ~600 chars por acórdão, e a
 * busca semântica respondia só pela ementa. As duas causas já foram corrigidas;
 * este script drena o passivo.
 *
 * Fila (auto-drenante e idempotente): acórdãos cujo `extractedText` ainda é
 * muito menor que o `tcuTextoCompleto`. Ao reprocessar, `extractedText` passa a
 * ser o inteiro teor e o documento sai da fila sozinho — dá para interromper e
 * retomar sem controle de estado externo.
 *
 * Uso:
 *   npx tsx scripts/backfill-inteiro-teor-embeddings.ts                 # estimativa (dry-run é o padrão)
 *   npx tsx scripts/backfill-inteiro-teor-embeddings.ts --preco 0.15    # estimativa com outro preço USD/1M tokens
 *   npx tsx scripts/backfill-inteiro-teor-embeddings.ts --executar --limit 20
 *   npx tsx scripts/backfill-inteiro-teor-embeddings.ts --executar --concurrency 3
 *
 * Sem `--executar` NADA é gravado: o padrão é estimar.
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { processDocument } from '../lib/embeddings/document-processor';
import { chunkTCUDocument } from '../lib/embeddings/text-chunker';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

/** USD por 1M de tokens de embedding. Confirmar a tarifa vigente antes de rodar. */
const PRECO_PADRAO_USD_POR_MILHAO = 0.15;
/** Amostra usada para calibrar a razão chars->chunks com o chunker real. */
const AMOSTRA_CALIBRACAO = 25;
/** ~4 chars por token, mesma heurística de text-chunker.estimateTokens. */
const CHARS_POR_TOKEN = 4;

interface Args {
  executar: boolean;
  limit?: number;
  concurrency: number;
  preco: number;
  /** Processa os maiores primeiro — util para validar o caminho pesado antes da rodada cheia. */
  maiores: boolean;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const val = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 && a[i + 1] ? a[i + 1] : undefined;
  };
  return {
    executar: a.includes('--executar'),
    limit: val('--limit') ? parseInt(val('--limit')!, 10) : undefined,
    concurrency: val('--concurrency') ? parseInt(val('--concurrency')!, 10) : 3,
    preco: val('--preco') ? parseFloat(val('--preco')!) : PRECO_PADRAO_USD_POR_MILHAO,
    maiores: a.includes('--maiores'),
  };
}

/**
 * Acórdãos com inteiro teor que ainda não estão indexados por ele.
 *
 * Três condições, todas auto-drenantes:
 *  1. texto-fonte ainda é a ementa (extractedText muito menor que o inteiro
 *     teor) — o corte em metade tolera a normalização, que encolhe o texto;
 *  2. embeddingStatus = 'failed' — retentativa;
 *  3. zero chunks — o caso patológico. `processDocument` grava o extractedText
 *     ANTES de chunkar, então um documento que falhou no meio sairia da
 *     condição (1) mesmo sem nenhum chunk no índice.
 */
const FILA_SQL = `
  FROM "Document" d
  WHERE d.category = 'acordao'
    AND d."tcuTextoCompleto" IS NOT NULL
    AND (
      length(coalesce(d."extractedText", '')) < length(d."tcuTextoCompleto") / 2
      OR d."embeddingStatus" = 'failed'
      OR NOT EXISTS (SELECT 1 FROM "DocumentChunk" c WHERE c."documentId" = d.id)
    )
`;

async function estimar(args: Args) {
  const [agg] = await prisma.$queryRawUnsafe<Array<{
    docs: number; chars: bigint; maior: number; media: number;
  }>>(`
    SELECT count(*)::int AS docs,
           sum(length("tcuTextoCompleto"))::bigint AS chars,
           max(length("tcuTextoCompleto"))::int AS maior,
           avg(length("tcuTextoCompleto"))::int AS media
    ${FILA_SQL}
  `);

  const docs = agg.docs;
  if (docs === 0) {
    console.log('Fila vazia - nada a reindexar.');
    return;
  }
  const charsTotais = Number(agg.chars);

  // Calibra chars->chunks rodando o chunker real numa amostra, em vez de supor
  // a divisão teórica: o chunker respeita parágrafos e seções, então o número
  // de chunks reais difere de charsTotais / (maxChunkSize - overlap).
  const amostra = await prisma.$queryRawUnsafe<Array<{ texto: string }>>(`
    SELECT "tcuTextoCompleto" AS texto ${FILA_SQL}
    ORDER BY random() LIMIT ${AMOSTRA_CALIBRACAO}
  `);
  let charsAmostra = 0, chunksAmostra = 0, charsIndexadosAmostra = 0;
  for (const { texto } of amostra) {
    const chunks = chunkTCUDocument(texto);
    charsAmostra += texto.length;
    chunksAmostra += chunks.length;
    charsIndexadosAmostra += chunks.reduce((s, c) => s + c.content.length, 0);
  }
  // Fator > 1: o overlap de 400 chars é reembeddado em cada chunk seguinte.
  const fatorOverlap = charsIndexadosAmostra / charsAmostra;
  const chunksPorChar = chunksAmostra / charsAmostra;

  const chunksEstimados = Math.round(charsTotais * chunksPorChar);
  const charsEmbeddados = charsTotais * fatorOverlap;
  const tokens = charsEmbeddados / CHARS_POR_TOKEN;
  const custoUSD = (tokens / 1_000_000) * args.preco;

  // ~3 KB do vetor de 768 floats + o texto do chunk.
  const armazenamentoMB = (chunksEstimados * (768 * 4 + 3000)) / 1_048_576;
  // Batches de 100 textos, ~3s por batch entre chamada e delay de rate limit.
  const batches = Math.ceil(chunksEstimados / 100);
  const minutos = (batches * 3) / 60;

  const chunksHoje = await prisma.$queryRawUnsafe<Array<{ n: number }>>(`
    SELECT count(*)::int AS n FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId" WHERE d.category = 'acordao'
  `);

  console.log('\n=== ESTIMATIVA DO BACKFILL DE INTEIRO TEOR ===\n');
  console.log(`Acórdãos na fila:            ${docs.toLocaleString('pt-BR')}`);
  console.log(`Texto a indexar:             ${(charsTotais / 1e6).toFixed(1)} milhões de chars`);
  console.log(`  média por acórdão:         ${agg.media.toLocaleString('pt-BR')} chars`);
  console.log(`  maior acórdão:             ${agg.maior.toLocaleString('pt-BR')} chars`);
  console.log(`\nCalibração (amostra de ${amostra.length} acórdãos, chunker real):`);
  console.log(`  chunks por acórdão:        ${(chunksAmostra / amostra.length).toFixed(0)}`);
  console.log(`  fator de overlap:          ${fatorOverlap.toFixed(2)}x`);
  console.log(`\nProjeção:`);
  console.log(`  chunks novos:              ${chunksEstimados.toLocaleString('pt-BR')}  (hoje: ${chunksHoje[0].n.toLocaleString('pt-BR')})`);
  console.log(`  tokens de embedding:       ${(tokens / 1e6).toFixed(1)} milhões`);
  console.log(`  CUSTO a US$ ${args.preco}/1M:      US$ ${custoUSD.toFixed(2)}`);
  console.log(`  armazenamento no Neon:     ~${armazenamentoMB.toFixed(0)} MB`);
  console.log(`  tempo de execução:         ~${minutos.toFixed(0)} min (concorrência ${args.concurrency} reduz isso)`);
  console.log(`\nPreço é premissa (--preco altera). Confirmar a tarifa vigente do`);
  console.log(`modelo de embedding no painel do Google antes de executar.`);
  console.log(`\nPara executar:  npx tsx scripts/backfill-inteiro-teor-embeddings.ts --executar\n`);
}

async function executar(args: Args) {
  const alvos = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; chars: number }>>(`
    SELECT id, title, length("tcuTextoCompleto") AS chars
    ${FILA_SQL}
    ORDER BY length("tcuTextoCompleto") ${args.maiores ? 'DESC' : 'ASC'}
    ${args.limit ? `LIMIT ${args.limit}` : ''}
  `);

  console.log(`\nReindexando ${alvos.length} acórdãos (concorrência ${args.concurrency})...\n`);

  let ok = 0, falha = 0, chunks = 0;
  const inicio = Date.now();

  for (let i = 0; i < alvos.length; i += args.concurrency) {
    const lote = alvos.slice(i, i + args.concurrency);
    const rs = await Promise.all(
      lote.map(d =>
        processDocument(d.id, { forceReprocess: true }).catch(e => ({
          success: false as const,
          error: e instanceof Error ? e.message : String(e),
        })),
      ),
    );
    rs.forEach((r, j) => {
      const d = lote[j];
      if (r.success) {
        ok++;
        const n = (r as { stats?: { chunkCount?: number } }).stats?.chunkCount ?? 0;
        chunks += n;
        console.log(`OK   ${d.title} - ${n} chunks (${d.chars.toLocaleString('pt-BR')} chars)`);
      } else {
        falha++;
        console.log(`FALHA ${d.title} - ${(r as { error?: string }).error}`);
      }
    });
    const feitos = Math.min(i + args.concurrency, alvos.length);
    if (feitos % 25 === 0 || feitos === alvos.length) {
      const min = (Date.now() - inicio) / 60000;
      console.log(`   ...${feitos}/${alvos.length} - ${chunks.toLocaleString('pt-BR')} chunks - ${min.toFixed(1)} min`);
    }
  }

  console.log(`\nConcluído: ${ok} ok, ${falha} falhas, ${chunks.toLocaleString('pt-BR')} chunks criados.`);
  if (falha > 0) console.log('Falhas ficam na fila - basta rodar de novo.');
}

async function main() {
  const args = parseArgs();
  if (args.executar) await executar(args);
  else await estimar(args);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
