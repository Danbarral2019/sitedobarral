/**
 * Backfill shadow — reembeda o MESMO content das 3 tabelas de chunk em 1536d
 * na coluna embedding1536. Idempotente (só toca linhas com embedding1536 IS NULL),
 * retomável. Não altera a coluna `embedding` de produção.
 *
 * Uso: npx dotenv -e .env.local -- tsx scripts/embed-shadow-1536.ts
 */
import { prisma } from '@/lib/prisma'
import { generateBatchEmbeddings, embeddingToSql } from '@/lib/embeddings/gemini-embeddings'

const DIM = 1536
const BATCH = 50
const TABLES = ['DocumentChunk', 'LegislativeActChunk', 'TribunalDecisionChunk'] as const

async function backfillTable(table: string): Promise<number> {
  let total = 0
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; content: string }[]>(
      `SELECT id, content FROM "${table}"
       WHERE embedding1536 IS NULL AND content IS NOT NULL AND length(content) > 0
       LIMIT ${BATCH}`,
    )
    if (rows.length === 0) break
    const { embeddings } = await generateBatchEmbeddings(rows.map((r) => r.content), DIM)
    for (let i = 0; i < rows.length; i++) {
      const vec = embeddingToSql(embeddings[i]) // string "[...]"
      await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET embedding1536 = '${vec}'::vector WHERE id = $1`,
        rows[i].id,
      )
    }
    total += rows.length
    console.log(`[${table}] +${rows.length} (acumulado ${total})`)
  }
  return total
}

async function main() {
  for (const t of TABLES) {
    console.log(`\n=== ${t} ===`)
    const n = await backfillTable(t)
    console.log(`[${t}] concluído: ${n} linhas`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
