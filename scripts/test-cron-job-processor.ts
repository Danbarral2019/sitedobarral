/**
 * Test Cron Job Processor
 *
 * Creates a test IndexJob and processes it using the cron endpoint
 */

import { prisma } from '../lib/prisma';

async function testCronJobProcessor() {
  console.log('\n🧪 ========================================');
  console.log('   CRON JOB PROCESSOR TEST');
  console.log('========================================\n');

  try {
    // 1. Find or create a test document without Gemini index
    console.log('📄 Finding test document...');

    let testDoc = await prisma.document.findFirst({
      where: {
        r2Key: { not: null },
        geminiIndexed: false,
      },
      select: {
        id: true,
        title: true,
        r2Key: true,
      },
    });

    // If no unindexed doc, reset an existing one for testing
    if (!testDoc) {
      testDoc = await prisma.document.findFirst({
        where: {
          r2Key: { not: null },
          geminiIndexed: true,
        },
        select: {
          id: true,
          title: true,
          r2Key: true,
        },
      });

      if (!testDoc) {
        console.error('❌ No document with R2 key found');
        process.exit(1);
      }

      // Reset Gemini index for testing
      console.log(`🔄 Resetting Gemini index for: ${testDoc.title}`);
      await prisma.document.update({
        where: { id: testDoc.id },
        data: {
          geminiIndexed: false,
          geminiFileId: null,
          geminiLastIndexed: null,
          geminiIndexError: null,
        },
      });
    }

    console.log(`✅ Test document: ${testDoc.title}`);
    console.log(`   Document ID: ${testDoc.id}`);
    console.log(`   R2 Key: ${testDoc.r2Key}`);

    // 2. Create IndexJob
    console.log('\n📝 Creating IndexJob...');
    const job = await prisma.indexJob.create({
      data: {
        entityType: 'document',
        entityId: testDoc.id,
        status: 'pending',
        priority: 10, // High priority for testing
      },
    });

    console.log(`✅ IndexJob created: ${job.id}`);
    console.log(`   Entity: ${job.entityType}/${job.entityId}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Priority: ${job.priority}`);

    // 3. Call cron endpoint to process
    console.log('\n⚙️  Calling cron endpoint...');

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      throw new Error('CRON_SECRET not configured');
    }

    const response = await fetch('http://localhost:3000/api/cron/process-index-jobs', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cron endpoint failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Cron endpoint response:`, result);

    // 4. Check job status
    console.log('\n🔍 Checking job status...');
    const updatedJob = await prisma.indexJob.findUnique({
      where: { id: job.id },
    });

    if (!updatedJob) {
      throw new Error('Job not found after processing');
    }

    console.log(`   Status: ${updatedJob.status}`);
    console.log(`   Attempts: ${updatedJob.attempts}`);
    console.log(`   Processed At: ${updatedJob.processedAt || 'N/A'}`);
    console.log(`   Error: ${updatedJob.lastError || 'None'}`);

    // 5. Check document Gemini metadata
    console.log('\n📄 Checking document Gemini metadata...');
    const updatedDoc = await prisma.document.findUnique({
      where: { id: testDoc.id },
      select: {
        geminiIndexed: true,
        geminiFileId: true,
        geminiLastIndexed: true,
        geminiIndexError: true,
      },
    });

    if (!updatedDoc) {
      throw new Error('Document not found');
    }

    console.log(`   Gemini Indexed: ${updatedDoc.geminiIndexed ? '✅ YES' : '❌ NO'}`);
    console.log(`   Gemini File ID: ${updatedDoc.geminiFileId || 'N/A'}`);
    console.log(`   Last Indexed: ${updatedDoc.geminiLastIndexed?.toISOString() || 'N/A'}`);
    console.log(`   Index Error: ${updatedDoc.geminiIndexError || 'None'}`);

    // 6. Final verdict
    console.log('\n\n✅ ========================================');
    if (updatedJob.status === 'completed' && updatedDoc.geminiIndexed) {
      console.log('   TEST PASSED! ✅');
      console.log('========================================\n');
      console.log('🎉 Cron job processor is working correctly!');
      console.log('   - IndexJob processed successfully');
      console.log('   - Document indexed to Gemini');
      console.log('   - Gemini File ID stored in database');
    } else {
      console.log('   TEST FAILED! ❌');
      console.log('========================================\n');
      console.log(`   Job status: ${updatedJob.status} (expected: completed)`);
      console.log(`   Doc indexed: ${updatedDoc.geminiIndexed} (expected: true)`);
      console.log(`   Error: ${updatedJob.lastError || updatedDoc.geminiIndexError || 'Unknown'}`);
    }

  } catch (error) {
    console.error('\n\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCronJobProcessor();
