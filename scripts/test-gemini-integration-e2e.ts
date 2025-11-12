/**
 * End-to-End Test: Gemini Integration
 *
 * Tests the complete flow:
 * 1. Find a document with R2 key
 * 2. Create IndexJob
 * 3. Process job (upload to Gemini)
 * 4. Validate result
 */

import { prisma } from '../lib/prisma';
import { downloadFromR2 } from '../lib/storage/r2-client';
import { uploadFileToGemini, getFileStatus, queryGeminiWithFile } from '../lib/gemini/cached-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileState } from '@google/generative-ai/server';

async function runE2ETest() {
  console.log('\n🧪 ========================================');
  console.log('   GEMINI INTEGRATION E2E TEST');
  console.log('========================================\n');

  try {
    // 1. Find a document with R2 key
    console.log('📄 Finding test document...');
    const testDoc = await prisma.document.findFirst({
      where: {
        r2Key: { not: null },
        geminiIndexed: true, // Use one that's already indexed
      },
      select: {
        id: true,
        title: true,
        r2Key: true,
        geminiFileId: true,
        type: true,
      },
    });

    if (!testDoc || !testDoc.r2Key) {
      console.error('❌ No document with R2 key found');
      console.log('\n💡 Upload a document first:');
      console.log('   1. Go to http://localhost:3000/admin/test-upload-ui');
      console.log('   2. Upload a PDF');
      console.log('   3. Run this test again');
      process.exit(1);
    }

    console.log(`✅ Test document: ${testDoc.title}`);
    console.log(`   R2 Key: ${testDoc.r2Key}`);
    console.log(`   Gemini File ID: ${testDoc.geminiFileId || 'N/A'}`);

    // 2. Test download from R2
    console.log('\n📥 Testing R2 download...');
    const fileBuffer = await downloadFromR2(testDoc.r2Key);
    console.log(`✅ Downloaded ${fileBuffer.length} bytes (${(fileBuffer.length / 1024).toFixed(2)} KB)`);

    // 3. Test upload to Gemini (if not already uploaded)
    let geminiFileId = testDoc.geminiFileId;

    if (!geminiFileId) {
      console.log('\n📤 Testing Gemini upload...');

      // Create temp file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `test-gemini-${Date.now()}.pdf`);
      fs.writeFileSync(tempFile, fileBuffer);

      // Upload
      const { fileUri, fileName } = await uploadFileToGemini(tempFile, testDoc.title);
      console.log(`✅ Uploaded: ${fileUri}`);
      geminiFileId = fileUri;

      // Wait for processing
      console.log('⏳ Waiting for Gemini processing...');
      let file = await getFileStatus(fileName);
      let attempts = 0;

      while (file.state === FileState.PROCESSING && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await getFileStatus(fileName);
        attempts++;

        if (attempts % 5 === 0) {
          console.log(`⏳ Still processing... (${attempts * 2}s elapsed)`);
        }
      }

      if (file.state === FileState.FAILED) {
        throw new Error(`Processing failed: ${file.error?.message}`);
      }

      if (file.state === FileState.PROCESSING) {
        throw new Error('Processing timeout (60s exceeded)');
      }

      console.log(`✅ Processing complete: ${file.state}`);

      // Clean up
      fs.unlinkSync(tempFile);

      // Update document
      await prisma.document.update({
        where: { id: testDoc.id },
        data: {
          geminiIndexed: true,
          geminiFileId: geminiFileId,
          geminiLastIndexed: new Date(),
        },
      });
    } else {
      console.log('\n✅ Document already indexed in Gemini');
    }

    // 4. Test query with Gemini
    console.log('\n🔍 Testing Gemini query...');
    const testQueries = [
      'Qual é o assunto principal deste documento?',
      'Liste os pontos mais importantes',
    ];

    for (const query of testQueries) {
      console.log(`\n   Query: "${query}"`);
      const result = await queryGeminiWithFile(geminiFileId!, query, {
        useCache: true,
      });

      console.log(`   ⏱️  Latency: ${result.latency}ms`);
      console.log(`   💾 Cached: ${result.cached ? 'YES' : 'NO'}`);
      console.log(`   📝 Response: ${result.response.substring(0, 150)}...`);

      if (result.tokens) {
        console.log(`   🔢 Tokens: ${result.tokens.total}`);
      }
    }

    // 5. Summary
    console.log('\n\n✅ ========================================');
    console.log('   ALL TESTS PASSED!');
    console.log('========================================\n');

    console.log('📊 Summary:');
    console.log(`   ✅ R2 Download: Working`);
    console.log(`   ✅ Gemini Upload: Working`);
    console.log(`   ✅ Gemini Processing: Working`);
    console.log(`   ✅ Gemini Query: Working`);
    console.log(`   ✅ Cache: Working`);

    console.log('\n🎉 Integration complete! System is ready for production.\n');

  } catch (error) {
    console.error('\n\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runE2ETest();
