/**
 * BIA-2 — gate de viabilidade R$0 (usado para decidir se valia medir na régua).
 * Para cada query anotada do golden, roda o retrieval de produção e verifica se
 * algum dos top-3 resultados do tipo Document é MULTI-CHUNK (>=5 chunks) — o
 * único caso em que injetar mais do documento (reassemblado dos chunks)
 * acrescenta texto além do trecho recuperado.
 *
 * Resultado em 2026-07-09: 34/55 (62%) das queries eram endereçáveis — massa
 * suficiente para medir. O A/B na régua, porém, deu NO-GO (ver
 * docs/ROADMAP_BUSCA_QUALIDADE.md): completude/faithfulness subiram levemente
 * mas as CITAÇÕES caíram nas queries expandidas e o overall ficou plano. Script
 * mantido como referência reutilizável do gate. Só usa embeddings Gemini + PG.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hybridSearch } from '@/lib/embeddings/hybrid-search';
import { prisma } from '@/lib/prisma';
import type { GoldenSet } from '../types';

const MULTI = 5; // limiar de "documento com corpo além do chunk"
const TOPN = 3;

async function chunkCount(documentId: string): Promise<number> {
  return prisma.documentChunk.count({ where: { documentId } });
}

async function main() {
  const gs: GoldenSet = JSON.parse(readFileSync(join(process.cwd(), 'eval/golden-set.json'), 'utf8'));
  const queries = gs.queries.filter((q) => q.annotations.relevant.length > 0);
  console.log(`Avaliando ${queries.length} queries anotadas (top-${TOPN} docs, limiar >=${MULTI} chunks)\n`);

  let addressable = 0;
  const hits: string[] = [];
  for (const q of queries) {
    const { results } = await hybridSearch({ query: q.query, limit: 20, alpha: 0.6, useCache: true });
    const topDocs = results.filter((r) => (r.sourceType ?? 'document') === 'document').slice(0, TOPN);
    let maxChunks = 0;
    for (const d of topDocs) {
      const n = await chunkCount(d.documentId);
      if (n > maxChunks) maxChunks = n;
    }
    if (maxChunks >= MULTI) {
      addressable++;
      hits.push(`  ${q.id} (top doc com ${maxChunks} chunks): ${q.query.slice(0, 50)}`);
    }
  }

  console.log(`Queries onde o BIA-2 acrescentaria texto (top-${TOPN} tem doc >=${MULTI} chunks): ${addressable}/${queries.length} (${((addressable / queries.length) * 100).toFixed(0)}%)`);
  if (hits.length) {
    console.log('\nQueries endereçáveis:');
    hits.forEach((h) => console.log(h));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
