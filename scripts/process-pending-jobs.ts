/**
 * Process Pending IndexJobs Manually
 *
 * Processes pending IndexJobs immediately without waiting for cron
 * Useful for testing and development
 *
 * Usage: npx tsx scripts/process-pending-jobs.ts
 */

import { prisma } from '../lib/prisma';
import { downloadFromR2 } from '../lib/storage/r2-client';
import { uploadFileToGemini } from '../lib/gemini/cached-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function processDocumentJob(job: any) {
  console.log(`\n📄 Processing document job: ${job.id}`);
  console.log(`   Entity: ${job.entityType} (${job.entityId})`);

  try {
    // 1. Fetch document
    const document = await prisma.document.findUnique({
      where: { id: job.entityId },
      select: {
        id: true,
        title: true,
        r2Key: true,
        type: true,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (!document.r2Key) {
      throw new Error('Document has no R2 key');
    }

    console.log(`   Document: ${document.title}`);
    console.log(`   R2 Key: ${document.r2Key}`);

    // 2. Download from R2
    console.log('   📥 Downloading from R2...');
    const fileBuffer = await downloadFromR2(document.r2Key);
    console.log(`   ✅ Downloaded ${fileBuffer.length} bytes`);

    // 3. Save to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `upload-${Date.now()}.pdf`);
    fs.writeFileSync(tempFile, fileBuffer);

    // 4. Upload to Gemini
    console.log('   📤 Uploading to Gemini...');
    const { fileUri, fileName } = await uploadFileToGemini(tempFile, document.title);
    console.log(`   ✅ Uploaded to Gemini`);
    console.log(`   File URI: ${fileUri}`);
    console.log(`   File Name: ${fileName}`);

    // 5. Cleanup temp file
    fs.unlinkSync(tempFile);

    // 6. Update document
    await prisma.document.update({
      where: { id: document.id },
      data: {
        geminiIndexed: true,
        geminiFileId: fileUri,
        geminiLastIndexed: new Date(),
        geminiIndexError: null,
      },
    });

    console.log('   ✅ Document updated with Gemini metadata');

    // 7. Mark job as completed
    await prisma.indexJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        processedAt: new Date(),
        lastError: null,
      },
    });

    console.log('   ✅ Job marked as completed');

    return { success: true };
  } catch (error) {
    console.error('   ❌ Error:', error);

    // Mark job as failed
    await prisma.indexJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        processedAt: new Date(),
      },
    });

    return { success: false, error };
  }
}

async function main() {
  console.log('\n🔄 ========================================');
  console.log('   PROCESS PENDING INDEX JOBS');
  console.log('========================================\n');

  // Fetch pending jobs
  const pendingJobs = await prisma.indexJob.findMany({
    where: {
      status: 'pending',
      attempts: {
        lt: 3,
      },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 10,
  });

  console.log(`📋 Found ${pendingJobs.length} pending job(s)\n`);

  if (pendingJobs.length === 0) {
    console.log('✅ No pending jobs to process');
    return;
  }

  // Process each job
  let completed = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    // Only process document jobs for now
    if (job.entityType === 'document') {
      const result = await processDocumentJob(job);
      if (result.success) {
        completed++;
      } else {
        failed++;
      }
    } else {
      console.log(`\n⏭️  Skipping ${job.entityType} job (not implemented yet)`);
    }
  }

  console.log('\n📊 ========================================');
  console.log('   SUMMARY');
  console.log('========================================\n');
  console.log(`✅ Completed: ${completed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${pendingJobs.length}\n`);
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
