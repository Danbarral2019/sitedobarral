/**
 * Migration Script: Gemini File API → Embeddings/pgvector
 *
 * Este script migra todos os documentos existentes para o novo sistema
 * de busca semantica baseado em embeddings.
 *
 * Passos:
 * 1. Habilita extensao pgvector no banco
 * 2. Processa todos os documentos com r2Key
 * 3. Extrai texto, cria chunks e gera embeddings
 *
 * Uso:
 *   npx tsx scripts/migrate-to-embeddings.ts
 *   npx tsx scripts/migrate-to-embeddings.ts --limit 100  # Limitar documentos
 *   npx tsx scripts/migrate-to-embeddings.ts --force      # Reprocessar todos
 *   npx tsx scripts/migrate-to-embeddings.ts --dry-run    # Simular execucao
 */

import { PrismaClient } from '@prisma/client';
import { processDocument, processPendingDocuments, getProcessingStats } from '../lib/embeddings/document-processor';

// ===========================
// Configuration
// ===========================

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

interface MigrationOptions {
  limit?: number;
  forceReprocess?: boolean;
  dryRun?: boolean;
  concurrency?: number;
}

// ===========================
// Main Migration Function
// ===========================

async function migrateToEmbeddings(options: MigrationOptions = {}) {
  const {
    limit,
    forceReprocess = false,
    dryRun = false,
    concurrency = 5,
  } = options;

  console.log('🚀 Starting migration to embeddings system...\n');
  console.log('Options:', { limit, forceReprocess, dryRun, concurrency });
  console.log('');

  try {
    // ===========================
    // Step 1: Enable pgvector extension
    // ===========================

    console.log('📦 Step 1: Enabling pgvector extension...');

    if (!dryRun) {
      try {
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
        console.log('✅ pgvector extension enabled');
      } catch (error) {
        console.log('⚠️  pgvector extension may already exist or require manual setup');
        console.log('   Error:', (error as Error).message);
      }
    } else {
      console.log('   [DRY RUN] Would enable pgvector extension');
    }

    console.log('');

    // ===========================
    // Step 2: Get documents to process
    // ===========================

    console.log('📋 Step 2: Finding documents to process...');

    const whereClause: any = {
      // Documentos com R2 OU com conteúdo textual
      OR: [
        { r2Key: { not: null } },
        { content: { not: null } },
        { description: { not: null } },
        { extractedText: { not: null } },
      ],
    };

    if (!forceReprocess) {
      whereClause.AND = {
        OR: [
          { embeddingStatus: null },
          { embeddingStatus: 'pending' },
          { embeddingStatus: 'failed' },
        ],
      };
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        category: true,
        embeddingStatus: true,
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
    });

    console.log(`   Found ${documents.length} documents to process`);

    if (documents.length === 0) {
      console.log('\n✅ No documents to process. Migration complete!');
      return;
    }

    // Show breakdown by status
    const statusCounts = documents.reduce((acc, doc) => {
      const status = doc.embeddingStatus || 'null';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('   Status breakdown:', statusCounts);
    console.log('');

    if (dryRun) {
      console.log('[DRY RUN] Would process the following documents:');
      documents.slice(0, 10).forEach(doc => {
        console.log(`   - ${doc.title} (${doc.category}) [${doc.embeddingStatus || 'pending'}]`);
      });
      if (documents.length > 10) {
        console.log(`   ... and ${documents.length - 10} more`);
      }
      console.log('\n[DRY RUN] No changes made. Run without --dry-run to process.');
      return;
    }

    // ===========================
    // Step 3: Process documents
    // ===========================

    console.log('⚙️  Step 3: Processing documents...');
    console.log(`   Concurrency: ${concurrency} documents at a time`);
    console.log('');

    const startTime = Date.now();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let totalChunks = 0;

    // Process in batches
    for (let i = 0; i < documents.length; i += concurrency) {
      const batch = documents.slice(i, i + concurrency);
      const batchNum = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(documents.length / concurrency);

      console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} documents)...`);

      const results = await Promise.all(
        batch.map(doc => processDocument(doc.id, { forceReprocess }))
      );

      for (const result of results) {
        processed++;
        if (result.success) {
          succeeded++;
          totalChunks += result.stats?.chunkCount || 0;
        } else {
          failed++;
          console.log(`   ❌ Failed: ${result.documentId} - ${result.error}`);
        }
      }

      // Progress report
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = documents.length - processed;
      const eta = remaining / rate;

      console.log(`   ✅ Progress: ${processed}/${documents.length} (${succeeded} ok, ${failed} failed)`);
      console.log(`   ⏱️  Rate: ${rate.toFixed(1)} docs/sec, ETA: ${formatTime(eta)}`);
      console.log('');

      // Small delay between batches to avoid overwhelming the API
      if (i + concurrency < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // ===========================
    // Step 4: Summary
    // ===========================

    const totalTime = (Date.now() - startTime) / 1000;
    const stats = await getProcessingStats();

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total processed: ${processed}`);
    console.log(`Succeeded: ${succeeded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total chunks created: ${totalChunks}`);
    console.log(`Total time: ${formatTime(totalTime)}`);
    console.log(`Average rate: ${(processed / totalTime).toFixed(1)} docs/sec`);
    console.log('');
    console.log('Database stats:');
    console.log(`  - Completed: ${stats.completed}`);
    console.log(`  - Pending: ${stats.pending}`);
    console.log(`  - Failed: ${stats.failed}`);
    console.log(`  - Total chunks: ${stats.totalChunks}`);
    console.log('');

    if (failed > 0) {
      console.log('⚠️  Some documents failed to process.');
      console.log('   Run again to retry failed documents.');
    } else {
      console.log('✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ===========================
// Helper Functions
// ===========================

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}m ${secs}s`;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--force') {
      options.forceReprocess = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--concurrency' && args[i + 1]) {
      options.concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Migration Script: Gemini File API → Embeddings/pgvector

Usage:
  npx tsx scripts/migrate-to-embeddings.ts [options]

Options:
  --limit <n>       Process only first N documents
  --force           Reprocess all documents (including completed)
  --dry-run         Show what would be processed without making changes
  --concurrency <n> Number of concurrent documents (default: 5)
  --help, -h        Show this help message

Examples:
  npx tsx scripts/migrate-to-embeddings.ts
  npx tsx scripts/migrate-to-embeddings.ts --limit 100
  npx tsx scripts/migrate-to-embeddings.ts --force --limit 50
  npx tsx scripts/migrate-to-embeddings.ts --dry-run
      `);
      process.exit(0);
    }
  }

  return options;
}

// ===========================
// Run Migration
// ===========================

const options = parseArgs();
migrateToEmbeddings(options)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
