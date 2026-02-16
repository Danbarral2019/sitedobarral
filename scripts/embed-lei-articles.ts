/**
 * Embedding dos Artigos da Lei 14.133/2021 (Fase 5B)
 *
 * Gera embeddings para os 195 artigos da Lei e insere na tabela LeiArticleEmbedding.
 * Permite busca semântica direta contra a query do usuário para encontrar artigos
 * relevantes independente dos documentos retornados.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/embed-lei-articles.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/embed-lei-articles.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/embed-lei-articles.ts --force
 */

import { PrismaClient } from '@prisma/client';
import { generateBatchEmbeddings, embeddingToSql } from '../lib/embeddings/gemini-embeddings';
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

interface Options {
  dryRun?: boolean;
  force?: boolean;
}

function buildArticleText(articleNumber: string): string {
  const article = LEI_14133_ARTIGOS[articleNumber];
  if (!article) return '';

  const parts: string[] = [];

  // Contexto estrutural para melhorar a qualidade semântica do embedding
  if (article.capituloCompleto) {
    parts.push(article.capituloCompleto);
  } else if (article.capitulo) {
    parts.push(article.capitulo);
  }

  // Texto do artigo
  parts.push(`Art. ${articleNumber} - ${article.ementa}`);

  return parts.join('\n');
}

async function embedLeiArticles(options: Options = {}) {
  const { dryRun = false, force = false } = options;

  console.log('🚀 Embedding dos Artigos da Lei 14.133/2021\n');
  console.log('Options:', { dryRun, force });
  console.log('');

  try {
    // 1. Listar artigos disponíveis
    const articleNumbers = Object.keys(LEI_14133_ARTIGOS);
    console.log(`📋 Total de artigos no data file: ${articleNumbers.length}`);

    // 2. Verificar quais já foram processados
    const existing = await prisma.$queryRawUnsafe<Array<{ articleNumber: string }>>(
      `SELECT "articleNumber" FROM "LeiArticleEmbedding"`
    );
    const existingSet = new Set(existing.map(e => e.articleNumber));
    console.log(`📋 Já processados no banco: ${existingSet.size}`);

    // 3. Determinar quais processar
    let toProcess: string[];
    if (force) {
      toProcess = articleNumbers;
      console.log(`🔄 --force: reprocessando todos os ${toProcess.length} artigos`);
    } else {
      toProcess = articleNumbers.filter(n => !existingSet.has(n));
      console.log(`📋 Pendentes: ${toProcess.length}`);
    }

    if (toProcess.length === 0) {
      console.log('\n✅ Todos os artigos já possuem embeddings. Use --force para reprocessar.');
      return;
    }

    // 4. Preparar textos para embedding
    const articles = toProcess.map(num => ({
      number: num,
      text: buildArticleText(num),
    })).filter(a => a.text.length > 0);

    console.log(`\n📝 Artigos para processar: ${articles.length}`);
    console.log(`   Exemplo (Art. ${articles[0].number}):`);
    console.log(`   ${articles[0].text.slice(0, 150)}...\n`);

    if (dryRun) {
      console.log('🏃 --dry-run: nenhuma alteração feita.');
      console.log(`   Seria(m) processado(s) ${articles.length} artigos em ${Math.ceil(articles.length / 100)} batch(es).`);
      return;
    }

    // 5. Gerar embeddings em batches
    const texts = articles.map(a => a.text);
    console.log(`⏳ Gerando embeddings (${Math.ceil(texts.length / 100)} batch(es) de até 100)...`);

    const startTime = Date.now();
    const result = await generateBatchEmbeddings(texts);
    const embeddingTime = Date.now() - startTime;

    console.log(`✅ Embeddings gerados: ${result.count} (${embeddingTime}ms)`);
    console.log(`   Modelo: ${result.model}, Dimensão: ${result.dimension}`);

    // 6. Inserir no banco via batch INSERT (limpar existentes se --force)
    if (force && existingSet.size > 0) {
      console.log(`🗑️  Removendo ${existingSet.size} registros existentes...`);
      await prisma.$executeRawUnsafe(`DELETE FROM "LeiArticleEmbedding"`);
    }

    console.log(`💾 Inserindo ${articles.length} registros no banco...`);

    // Batch insert em grupos de 50 para não exceder o limite de parâmetros SQL
    const BATCH_INSERT_SIZE = 50;
    let inserted = 0;

    for (let i = 0; i < articles.length; i += BATCH_INSERT_SIZE) {
      const batch = articles.slice(i, i + BATCH_INSERT_SIZE);
      const embedBatch = result.embeddings.slice(i, i + BATCH_INSERT_SIZE);

      const values = batch.map((article, idx) => {
        const embSql = embeddingToSql(embedBatch[idx]);
        return `(gen_random_uuid(), '${article.number}', '${article.text.replace(/'/g, "''")}', '${embSql}'::vector, NOW(), NOW())`;
      }).join(',\n');

      await prisma.$executeRawUnsafe(`
        INSERT INTO "LeiArticleEmbedding" (id, "articleNumber", content, embedding, "createdAt", "updatedAt")
        VALUES ${values}
        ON CONFLICT ("articleNumber") DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          "updatedAt" = NOW()
      `);

      inserted += batch.length;
      if (inserted % 100 === 0 || inserted === articles.length) {
        console.log(`   ${inserted}/${articles.length} inseridos`);
      }
    }

    // 7. Verificar
    const finalCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "LeiArticleEmbedding"`
    );
    const totalTime = Date.now() - startTime;

    console.log(`\n✅ Concluído!`);
    console.log(`   Total no banco: ${finalCount[0].count} registros`);
    console.log(`   Tempo total: ${totalTime}ms`);

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const options: Options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
};

embedLeiArticles(options);
