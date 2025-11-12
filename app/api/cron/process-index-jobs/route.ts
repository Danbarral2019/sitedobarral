import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadFromR2 } from '@/lib/storage/r2-client';
import { uploadFileToGemini, getFileStatus } from '@/lib/gemini/cached-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileState } from '@google/generative-ai/server';

// ===========================
// Configuration
// ===========================

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_JOBS_PER_RUN = 10; // Process up to 10 jobs per cron execution
const MAX_RETRY_ATTEMPTS = 3;

// ===========================
// Types
// ===========================

interface ProcessingResult {
  jobId: string;
  status: 'completed' | 'failed' | 'skipped';
  error?: string;
  geminiFileId?: string;
}

// ===========================
// Gemini Integration
// ===========================

/**
 * Upload file to Gemini File API and wait for processing
 *
 * @param fileBuffer - Buffer containing the file data
 * @param fileName - Display name for the file
 * @param mimeType - MIME type of the file
 * @returns Promise with fileId (URI), success status, and optional error
 */
async function uploadToGemini(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string; success: boolean; error?: string }> {
  let tempFile: string | null = null;

  try {
    // 1. Create temporary file from buffer
    const tempDir = os.tmpdir();
    tempFile = path.join(tempDir, `gemini-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.pdf`);
    fs.writeFileSync(tempFile, fileBuffer);

    console.log(`📤 Uploading to Gemini: ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB)`);

    // 2. Upload to Gemini File API
    const { fileUri, fileName: geminiFileName } = await uploadFileToGemini(tempFile, fileName);

    console.log(`✅ Uploaded: ${fileUri}`);

    // 3. Wait for processing to complete
    console.log('⏳ Waiting for Gemini processing...');

    let file = await getFileStatus(geminiFileName);
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2s = 60s max wait

    while (file.state === FileState.PROCESSING && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      file = await getFileStatus(geminiFileName);
      attempts++;

      if (attempts % 5 === 0) {
        console.log(`⏳ Still processing... (${attempts * 2}s elapsed)`);
      }
    }

    if (file.state === FileState.FAILED) {
      throw new Error(`Gemini processing failed: ${file.error?.message || 'Unknown error'}`);
    }

    if (file.state === FileState.PROCESSING) {
      throw new Error('Gemini processing timeout (60s exceeded)');
    }

    console.log(`✅ Processing complete: ${file.state}`);

    // 4. Clean up temp file
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    return {
      fileId: fileUri, // Return URI for use in queries
      success: true,
    };
  } catch (error) {
    console.error('❌ Gemini upload error:', error);

    // Clean up temp file on error
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        console.error('⚠️ Failed to clean up temp file:', cleanupError);
      }
    }

    return {
      fileId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Index text content to Gemini (for non-file entities like glossary, blog posts)
 *
 * Creates a temporary text file and uploads to Gemini File API
 *
 * @param textContent - Text content to index
 * @param entityType - Type of entity (glossary, blog-post, lei-article)
 * @param entityId - ID of the entity
 * @returns Promise with fileId (URI), success status, and optional error
 */
async function indexTextToGemini(
  textContent: string,
  entityType: string,
  entityId: string
): Promise<{ fileId: string; success: boolean; error?: string }> {
  let tempFile: string | null = null;

  try {
    // 1. Create temporary text file
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    tempFile = path.join(tempDir, `gemini-text-${entityType}-${timestamp}.txt`);
    fs.writeFileSync(tempFile, textContent, 'utf-8');

    console.log(`📝 Indexing text to Gemini: ${entityType}/${entityId} (${textContent.length} chars)`);

    // 2. Upload to Gemini File API
    const displayName = `${entityType}-${entityId}`;
    const { fileUri, fileName: geminiFileName } = await uploadFileToGemini(tempFile, displayName);

    console.log(`✅ Uploaded: ${fileUri}`);

    // 3. Wait for processing (text files usually process faster)
    console.log('⏳ Waiting for Gemini text processing...');

    let file = await getFileStatus(geminiFileName);
    let attempts = 0;
    const maxAttempts = 15; // 15 attempts * 1s = 15s max wait

    while (file.state === FileState.PROCESSING && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s (faster for text)
      file = await getFileStatus(geminiFileName);
      attempts++;
    }

    if (file.state === FileState.FAILED) {
      throw new Error(`Gemini text processing failed: ${file.error?.message || 'Unknown error'}`);
    }

    if (file.state === FileState.PROCESSING) {
      throw new Error('Gemini text processing timeout (15s exceeded)');
    }

    console.log(`✅ Text processing complete: ${file.state}`);

    // 4. Clean up temp file
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    return {
      fileId: fileUri,
      success: true,
    };
  } catch (error) {
    console.error('❌ Gemini text indexation error:', error);

    // Clean up temp file on error
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        console.error('⚠️ Failed to clean up temp file:', cleanupError);
      }
    }

    return {
      fileId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Text indexation failed',
    };
  }
}

// ===========================
// Job Processors
// ===========================

async function processDocumentJob(job: any): Promise<ProcessingResult> {
  try {
    // Fetch document from database
    const document = await prisma.document.findUnique({
      where: { id: job.entityId },
      select: {
        id: true,
        title: true,
        r2Key: true,
        type: true,
        url: true,
      },
    });

    if (!document) {
      return {
        jobId: job.id,
        status: 'failed',
        error: 'Document not found',
      };
    }

    if (!document.r2Key) {
      return {
        jobId: job.id,
        status: 'failed',
        error: 'Document has no R2 key (not uploaded to R2)',
      };
    }

    // Download file from R2
    const fileBuffer = await downloadFromR2(document.r2Key);

    // Determine MIME type
    const mimeType = getMimeTypeFromDocumentType(document.type);

    // Upload to Gemini
    const result = await uploadToGemini(fileBuffer, document.title, mimeType);

    if (!result.success) {
      throw new Error(result.error || 'Gemini upload failed');
    }

    // Update document with Gemini metadata
    await prisma.document.update({
      where: { id: document.id },
      data: {
        geminiIndexed: true,
        geminiFileId: result.fileId,
        geminiLastIndexed: new Date(),
        geminiIndexError: null,
      },
    });

    return {
      jobId: job.id,
      status: 'completed',
      geminiFileId: result.fileId,
    };
  } catch (error) {
    console.error(`Error processing document job ${job.id}:`, error);
    return {
      jobId: job.id,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function processGlossaryJob(job: any): Promise<ProcessingResult> {
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

    // Prepare text content for indexation
    const textContent = `
Termo: ${term.term}
Categoria: ${term.category || 'N/A'}
Definição: ${term.definition}
    `.trim();

    // Index to Gemini
    const result = await indexTextToGemini(textContent, 'glossary', term.id);

    if (!result.success) {
      throw new Error(result.error || 'Gemini indexation failed');
    }

    // TODO: Update glossary term with Gemini metadata when schema is extended
    // For now, just mark job as completed

    return {
      jobId: job.id,
      status: 'completed',
      geminiFileId: result.fileId,
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

async function processBlogPostJob(job: any): Promise<ProcessingResult> {
  try {
    const blogPost = await prisma.blogPost.findUnique({
      where: { id: job.entityId },
      select: {
        id: true,
        title: true,
        content: true,
        excerpt: true,
      },
    });

    if (!blogPost) {
      return {
        jobId: job.id,
        status: 'failed',
        error: 'Blog post not found',
      };
    }

    // Prepare text content
    const textContent = `
Título: ${blogPost.title}
Resumo: ${blogPost.excerpt}
Conteúdo: ${blogPost.content}
    `.trim();

    // Index to Gemini
    const result = await indexTextToGemini(textContent, 'blog-post', blogPost.id);

    if (!result.success) {
      throw new Error(result.error || 'Gemini indexation failed');
    }

    // TODO: Update blog post with Gemini metadata when schema is extended

    return {
      jobId: job.id,
      status: 'completed',
      geminiFileId: result.fileId,
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

async function processLeiArticleJob(job: any): Promise<ProcessingResult> {
  try {
    const article = await prisma.leiArticle.findUnique({
      where: { id: job.entityId },
      select: {
        id: true,
        numero: true,
        titulo: true,
        ementa: true,
        capitulo: true,
      },
    });

    if (!article) {
      return {
        jobId: job.id,
        status: 'failed',
        error: 'Lei article not found',
      };
    }

    // Prepare text content
    const textContent = `
Artigo: ${article.numero}
Título: ${article.titulo || 'N/A'}
Capítulo: ${article.capitulo}
Ementa: ${article.ementa}
    `.trim();

    // Index to Gemini
    const result = await indexTextToGemini(textContent, 'lei-article', article.id);

    if (!result.success) {
      throw new Error(result.error || 'Gemini indexation failed');
    }

    // TODO: Update lei article with Gemini metadata when schema is extended

    return {
      jobId: job.id,
      status: 'completed',
      geminiFileId: result.fileId,
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

async function processJob(job: any): Promise<ProcessingResult> {
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

    console.log('🔄 Starting index job processor...');

    // 2. Fetch pending jobs (ordered by priority DESC, createdAt ASC)
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

    console.log(`📋 Found ${pendingJobs.length} pending jobs`);

    if (pendingJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending jobs',
        processed: 0,
      });
    }

    // 3. Process each job
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
      const result = await processJob(job);
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

    // 4. Return summary
    const summary = {
      success: true,
      processed: results.length,
      completed: results.filter((r) => r.status === 'completed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };

    console.log(`✅ Processed ${summary.processed} jobs (${summary.completed} completed, ${summary.failed} failed)`);

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
// Helper Functions
// ===========================

function getMimeTypeFromDocumentType(type: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    image: 'image/png',
  };

  return mimeTypes[type] || 'application/octet-stream';
}
