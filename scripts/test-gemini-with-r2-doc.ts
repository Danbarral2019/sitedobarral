/**
 * Test Gemini File Search with R2 Document
 *
 * Downloads a document from R2 and tests Gemini File API
 *
 * Usage: npx tsx scripts/test-gemini-with-r2-doc.ts [document-id]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { prisma } from '../lib/prisma';
import { downloadFromR2 } from '../lib/storage/r2-client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  const args = process.argv.slice(2);

  // Get document ID from args or use most recent
  let docId: string | undefined = args[0];

  if (!docId) {
    console.log('📄 No document ID provided, fetching most recent...');
    const doc = await prisma.document.findFirst({
      where: { r2Key: { not: null } },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true },
    });

    if (!doc) {
      console.error('❌ No documents found with R2 key');
      process.exit(1);
    }

    docId = doc.id;
  }

  // Fetch document from database
  const document = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      title: true,
      r2Key: true,
      size: true,
      type: true,
    },
  });

  if (!document) {
    console.error(`❌ Document not found: ${docId}`);
    process.exit(1);
  }

  if (!document.r2Key) {
    console.error(`❌ Document has no R2 key: ${docId}`);
    process.exit(1);
  }

  console.log('\n📦 Document Info:');
  console.log(`   ID: ${document.id}`);
  console.log(`   Title: ${document.title}`);
  console.log(`   Type: ${document.type}`);
  console.log(`   Size: ${document.size ? `${(document.size / 1024).toFixed(1)} KB` : 'Unknown'}`);
  console.log(`   R2 Key: ${document.r2Key}\n`);

  // Download from R2
  console.log('📥 Downloading from R2...');
  const fileBuffer = await downloadFromR2(document.r2Key);
  console.log(`✅ Downloaded ${fileBuffer.length} bytes\n`);

  // Save to temp file
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `gemini-test-${Date.now()}.pdf`);

  fs.writeFileSync(tempFile, fileBuffer);
  console.log(`💾 Saved to: ${tempFile}\n`);

  // Run PoC script
  console.log('🔬 Running Gemini PoC...\n');
  console.log('═'.repeat(60));

  try {
    const { stdout, stderr } = await execAsync(
      `npx tsx scripts/poc-gemini-file-search.ts "${tempFile}"`,
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }
    );

    console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error: any) {
    console.error('PoC error:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
  } finally {
    // Cleanup temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log(`\n🧹 Cleaned up temp file: ${tempFile}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
