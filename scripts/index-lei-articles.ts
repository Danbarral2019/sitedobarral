/**
 * Popula a tabela `LeiArticleEmbedding` (Fase 2.1 do plano de retomada) com o
 * embedding do TEXTO INTEGRAL de cada artigo da Lei 14.133/2021.
 *
 * Motivo: a tabela estava VAZIA, então `selectRelevantArticles` degradava para
 * "só artigos citados nos docs". O baseline de síntese (eval, faithfulness 40,5%)
 * mostrou que, quando os docs recuperados são de outra lei/tema, o modelo INVENTA
 * o conteúdo dos artigos porque o texto deles nunca entra no contexto. Populando
 * esta tabela, a busca semântica passa a trazer os artigos pertinentes e o
 * `buildLeiContext` injeta o texto real.
 *
 * Simetria de embedding: a query usa prefixo `search_query:` (generateQueryEmbedding),
 * então os artigos usam o par `search_document:`.
 *
 * Uso:
 *   npx tsx scripts/index-lei-articles.ts            # dry-run (não grava)
 *   npx tsx scripts/index-lei-articles.ts --apply    # grava/atualiza a tabela
 *   npx tsx scripts/index-lei-articles.ts --apply --limit 5
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';
import { generateBatchEmbeddings, embeddingToSql } from '../lib/embeddings/gemini-embeddings';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : undefined;
const BATCH = 100;

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

async function main() {
  const articles = await prisma.leiArticle.findMany({
    select: { numero: true, ementa: true, titulo: true },
    orderBy: { numero: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`[index-lei] ${articles.length} artigos ${APPLY ? '(APPLY — vai gravar)' : '(dry-run)'}`);

  let written = 0;
  for (let i = 0; i < articles.length; i += BATCH) {
    const slice = articles.slice(i, i + BATCH);
    const texts = slice.map(
      (a) => `search_document: Art. ${a.numero} da Lei 14.133/2021${a.titulo ? ` — ${a.titulo}` : ''}. ${a.ementa}`,
    );
    const { embeddings, dimension } = await generateBatchEmbeddings(texts);
    if (embeddings.length !== slice.length) {
      throw new Error(`Batch retornou ${embeddings.length} embeddings para ${slice.length} artigos`);
    }
    console.log(`[index-lei] batch ${i / BATCH + 1}: ${slice.length} artigos, dim=${dimension}`);

    if (!APPLY) {
      // Dry-run: só valida geração + mostra amostra
      console.log(`   amostra: Art. ${slice[0].numero} → embedding[${embeddings[0].length}], ementa ${slice[0].ementa.length} chars`);
      continue;
    }

    const values = slice
      .map((a, j) => `(gen_random_uuid(), '${esc(a.numero)}', '${esc(a.ementa)}', '${embeddingToSql(embeddings[j])}'::vector, NOW(), NOW())`)
      .join(',\n');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "LeiArticleEmbedding" (id, "articleNumber", content, embedding, "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("articleNumber") DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        "updatedAt" = NOW()
    `);
    written += slice.length;
    console.log(`   gravados ${written}/${articles.length}`);
  }

  const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) as count FROM "LeiArticleEmbedding"');
  console.log(`[index-lei] fim. LeiArticleEmbedding agora tem ${Number(count[0].count)} linhas.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('[index-lei] FALHOU:', e); process.exit(1); });
