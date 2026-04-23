import { prisma } from '../lib/prisma';

async function main() {
  console.log('=== Informativos TCU no banco ===\n');

  // Procurar por informativos em Document (category ou title)
  const byCategory = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
    SELECT category, COUNT(*)::int as count
    FROM "Document"
    WHERE LOWER(category) LIKE '%informativo%' OR LOWER(title) LIKE '%informativo%'
    GROUP BY category
    ORDER BY count DESC
  `;
  console.log('Document com "informativo" em category ou title:');
  for (const row of byCategory) console.log(`  ${row.category}: ${row.count}`);

  // Todas as categorias que contêm 'tcu' ou 'informativo'
  const allCats = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
    SELECT category, COUNT(*)::int as count
    FROM "Document"
    GROUP BY category
    ORDER BY count DESC
  `;
  console.log('\nTodas categorias Document (para referência):');
  for (const row of allCats) console.log(`  ${row.category}: ${row.count}`);

  // Embeddings existentes
  console.log('\n=== Embeddings (DocumentChunk) ===');
  const embCount = await prisma.$queryRaw<Array<{ total: bigint; docs: bigint }>>`
    SELECT COUNT(*)::int as total, COUNT(DISTINCT "documentId")::int as docs FROM "DocumentChunk"
  `;
  console.log(`Total chunks: ${embCount[0].total} | Docs únicos indexados: ${embCount[0].docs}`);

  const byCatEmb = await prisma.$queryRaw<Array<{ category: string; docs: bigint }>>`
    SELECT d.category, COUNT(DISTINCT dc."documentId")::int as docs
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    GROUP BY d.category
    ORDER BY docs DESC
  `;
  console.log('\nDocs com embeddings por categoria:');
  for (const row of byCatEmb) console.log(`  ${row.category}: ${row.docs}`);

  console.log('\n=== Embedding status de acórdãos TCU em Document ===');
  const tcuEmbStatus = await prisma.$queryRaw<Array<{ status: string | null; count: bigint }>>`
    SELECT "embeddingStatus" as status, COUNT(*)::int as count
    FROM "Document"
    WHERE category IN ('acordao', 'consulta_tcu') AND "tcuNumeroAcordao" IS NOT NULL
    GROUP BY "embeddingStatus"
    ORDER BY count DESC
  `;
  for (const row of tcuEmbStatus) console.log(`  ${row.status ?? 'NULL'}: ${row.count}`);

  console.log('\n=== TribunalDecisionChunk (embeddings das decisões "não-TCU") ===');
  const tdChunks = await prisma.$queryRaw<Array<{ total: bigint; decisions: bigint }>>`
    SELECT COUNT(*)::int as total, COUNT(DISTINCT "tribunalDecisionId")::int as decisions FROM "TribunalDecisionChunk"
  `;
  console.log(`Total chunks: ${tdChunks[0].total} | Decisões indexadas: ${tdChunks[0].decisions}`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
