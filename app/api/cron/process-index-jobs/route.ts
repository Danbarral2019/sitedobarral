import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processDocument, getProcessingStats } from '@/lib/embeddings/document-processor';
import { processTribunalDecision } from '@/lib/embeddings/tribunal-decision-processor';

// ===========================
// Configuration
// ===========================

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_JOBS_PER_RUN = 10; // Process up to 10 documents per cron execution
const MAX_RETRY_ATTEMPTS = 3;

// ===========================
// Types
// ===========================

interface ProcessingResult {
  jobId: string;
  documentId?: string;
  status: 'completed' | 'failed' | 'skipped';
  error?: string;
  chunkCount?: number;
}

// ===========================
// Job Processors
// ===========================

/**
 * Process document job - extracts text, creates chunks, generates embeddings
 */
async function processDocumentJob(job: {
  id: string;
  entityId: string;
  attempts: number;
}): Promise<ProcessingResult> {
  try {
    const result = await processDocument(job.entityId, {
      forceReprocess: job.attempts > 0, // Force reprocess on retry
    });

    if (!result.success) {
      return {
        jobId: job.id,
        documentId: job.entityId,
        status: 'failed',
        error: result.error,
      };
    }

    return {
      jobId: job.id,
      documentId: job.entityId,
      status: 'completed',
      chunkCount: result.stats?.chunkCount,
    };
  } catch (error) {
    console.error(`Error processing document job ${job.id}:`, error);
    return {
      jobId: job.id,
      documentId: job.entityId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process glossary term job - generates embedding for term definition
 */
async function processGlossaryJob(job: {
  id: string;
  entityId: string;
}): Promise<ProcessingResult> {
  try {
    const term = await prisma.glossaryTerm.findUnique({
      where: { id: job.entityId },
      select: {
        id: true,
        term: true,
        definition: true,
        category: true,
      },
    });

    if (!term) {
      return {
        jobId: job.id,
        status: 'failed',
        error: 'Glossary term not found',
      };
    }

    // For now, glossary terms don't use the chunking/embedding system
    // They could be indexed separately in the future
    console.log(`📝 Glossary term "${term.term}" indexed (no embedding yet)`);

    return {
      jobId: job.id,
      status: 'completed',
    };
  } catch (error) {
    console.error(`Error processing glossary job ${job.id}:`, error);
    return {
      jobId: job.id,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process blog post job
 */
async function processBlogPostJob(job: {
  id: string;
  entityId: string;
}): Promise<ProcessingResult> {
  try {
    const blogPost = await prisma.blogPost.findUnique({
      where: { id: job.entityId },
      select: {
        id: true,
        title: true,
      },
    });

    if (!blogPost) {
      return {
        jobId: job.id,
        status: 'failed',
        error: 'Blog post not found',
      };
    }

    // Blog posts could be indexed for search in the future
    console.log(`📝 Blog post "${blogPost.title}" indexed (no embedding yet)`);

    return {
      jobId: job.id,
      status: 'completed',
    };
  } catch (error) {
    console.error(`Error processing blog post job ${job.id}:`, error);
    return {
      jobId: job.id,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process lei article job
 */
async function processLeiArticleJob(job: {
  id: string;
  entityId: string;
}): Promise<ProcessingResult> {
  try {
    const article = await prisma.leiArticle.findUnique({
      where: { id: job.entityId },
      select: {
        id: true,
        numero: true,
      },
    });

    if (!article) {
      return {
        jobId: job.id,
        status: 'failed',
        error: 'Lei article not found',
      };
    }

    // Lei articles could be indexed for search in the future
    console.log(`📝 Lei article "${article.numero}" indexed (no embedding yet)`);

    return {
      jobId: job.id,
      status: 'completed',
    };
  } catch (error) {
    console.error(`Error processing lei article job ${job.id}:`, error);
    return {
      jobId: job.id,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ===========================
// Main Processor
// ===========================

async function processJob(job: {
  id: string;
  entityType: string;
  entityId: string;
  attempts: number;
}): Promise<ProcessingResult> {
  // Route to appropriate processor based on entity type
  switch (job.entityType) {
    case 'document':
      return await processDocumentJob(job);
    case 'glossary':
      return await processGlossaryJob(job);
    case 'blog-post':
      return await processBlogPostJob(job);
    case 'lei-article':
      return await processLeiArticleJob(job);
    default:
      return {
        jobId: job.id,
        status: 'failed',
        error: `Unknown entity type: ${job.entityType}`,
      };
  }
}

// ===========================
// API Route
// ===========================

export async function GET(req: NextRequest) {
  try {
    // 1. Verify cron secret
    const authHeader = req.headers.get('authorization');

    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Starting embedding job processor...');

    // 2. Get processing stats
    const stats = await getProcessingStats();
    console.log(`📊 Stats: ${stats.completed} completed, ${stats.pending} pending, ${stats.failed} failed`);

    // 3. Fetch pending jobs from IndexJob table (ordered by priority DESC, createdAt ASC)
    const pendingJobs = await prisma.indexJob.findMany({
      where: {
        status: 'pending',
        attempts: {
          lt: MAX_RETRY_ATTEMPTS,
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: MAX_JOBS_PER_RUN,
    });

    // 4. Also fetch documents that need embedding (direct processing)
    const pendingDocuments = await prisma.document.findMany({
      where: {
        r2Key: { not: null },
        OR: [
          { embeddingStatus: null },
          { embeddingStatus: 'pending' },
        ],
      },
      select: { id: true },
      take: MAX_JOBS_PER_RUN - pendingJobs.length,
      orderBy: { uploadedAt: 'desc' },
    });

    const totalPending = pendingJobs.length + pendingDocuments.length;
    console.log(`📋 Found ${pendingJobs.length} jobs + ${pendingDocuments.length} pending documents`);

    if (totalPending === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending jobs',
        processed: 0,
        stats,
      });
    }

    // 5. Process IndexJob queue
    const results: ProcessingResult[] = [];

    for (const job of pendingJobs) {
      console.log(`⚙️  Processing job ${job.id} (${job.entityType})`);

      // Mark as processing
      await prisma.indexJob.update({
        where: { id: job.id },
        data: {
          status: 'processing',
          attempts: { increment: 1 },
        },
      });

      // Process the job
      const result = await processJob({
        id: job.id,
        entityType: job.entityType,
        entityId: job.entityId,
        attempts: job.attempts,
      });
      results.push(result);

      // Update job status
      if (result.status === 'completed') {
        await prisma.indexJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            processedAt: new Date(),
            lastError: null,
          },
        });
        console.log(`✅ Job ${job.id} completed`);
      } else if (result.status === 'failed') {
        const attempts = job.attempts + 1;
        const shouldRetry = attempts < MAX_RETRY_ATTEMPTS;

        await prisma.indexJob.update({
          where: { id: job.id },
          data: {
            status: shouldRetry ? 'pending' : 'failed',
            lastError: result.error,
            processedAt: shouldRetry ? undefined : new Date(),
          },
        });

        console.log(
          `❌ Job ${job.id} failed (attempt ${attempts}/${MAX_RETRY_ATTEMPTS})${
            shouldRetry ? ' - will retry' : ''
          }`
        );
      }
    }

    // 6. Process direct documents (without IndexJob entry)
    for (const doc of pendingDocuments) {
      console.log(`⚙️  Processing document ${doc.id} directly`);

      const result = await processDocument(doc.id);

      results.push({
        jobId: `direct-${doc.id}`,
        documentId: doc.id,
        status: result.success ? 'completed' : 'failed',
        error: result.error,
        chunkCount: result.stats?.chunkCount,
      });

      if (result.success) {
        console.log(`✅ Document ${doc.id} processed (${result.stats?.chunkCount} chunks)`);
      } else {
        console.log(`❌ Document ${doc.id} failed: ${result.error}`);
      }
    }

    // 7. Process pending tribunal decisions
    const pendingDecisions = await prisma.tribunalDecision.findMany({
      where: {
        approvalStatus: { in: ['auto_approved', 'manually_approved'] },
        OR: [
          { embeddingStatus: null },
          { embeddingStatus: 'pending' },
        ],
      },
      select: { id: true },
      take: Math.max(0, MAX_JOBS_PER_RUN - pendingJobs.length - pendingDocuments.length),
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${pendingDecisions.length} pending tribunal decisions`);

    for (const decision of pendingDecisions) {
      console.log(`Processing tribunal decision ${decision.id}`);

      const result = await processTribunalDecision(decision.id);

      results.push({
        jobId: `tribunal-${decision.id}`,
        documentId: decision.id,
        status: result.success ? 'completed' : 'failed',
        error: result.error,
        chunkCount: result.stats?.chunkCount,
      });

      if (result.success) {
        console.log(`Tribunal decision ${decision.id} processed (${result.stats?.chunkCount} chunks)`);
      } else {
        console.log(`Tribunal decision ${decision.id} failed: ${result.error}`);
      }
    }

    // 8. Return summary
    const summary = {
      success: true,
      processed: results.length,
      completed: results.filter((r) => r.status === 'completed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      totalChunksCreated: results.reduce((sum, r) => sum + (r.chunkCount || 0), 0),
      stats: await getProcessingStats(),
      results,
    };

    console.log(`✅ Processed ${summary.processed} items (${summary.completed} completed, ${summary.failed} failed, ${summary.totalChunksCreated} chunks created)`);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('❌ Index job processor error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ===========================
// Manual Trigger Route (POST)
// ===========================

/**
 * POST endpoint for manual triggering with specific document IDs
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');

    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { documentIds, forceReprocess = false } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds array required' },
        { status: 400 }
      );
    }

    console.log(`🔄 Manual processing of ${documentIds.length} documents...`);

    const results: ProcessingResult[] = [];

    for (const docId of documentIds) {
      console.log(`⚙️  Processing document ${docId}`);

      const result = await processDocument(docId, { forceReprocess });

      results.push({
        jobId: `manual-${docId}`,
        documentId: docId,
        status: result.success ? 'completed' : 'failed',
        error: result.error,
        chunkCount: result.stats?.chunkCount,
      });

      if (result.success) {
        console.log(`✅ Document ${docId} processed (${result.stats?.chunkCount} chunks)`);
      } else {
        console.log(`❌ Document ${docId} failed: ${result.error}`);
      }
    }

    const summary = {
      success: true,
      processed: results.length,
      completed: results.filter((r) => r.status === 'completed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      totalChunksCreated: results.reduce((sum, r) => sum + (r.chunkCount || 0), 0),
      results,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('❌ Manual processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
