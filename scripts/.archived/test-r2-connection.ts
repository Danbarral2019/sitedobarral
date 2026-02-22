/**
 * Test R2 Connection
 * Run: npx tsx scripts/test-r2-connection.ts
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import {
  uploadToR2,
  getPublicR2Url,
  listR2Files,
  downloadFromR2,
  deleteFromR2,
  fileExistsInR2,
} from '../lib/storage/r2-client';

async function testR2Connection() {
  console.log('🧪 Testing Cloudflare R2 Connection...\n');

  try {
    // Test 1: Upload
    console.log('1️⃣ Testing Upload...');
    const testKey = `test/test-${Date.now()}.txt`;
    const testContent = Buffer.from('Hello from Prof. Barral Site! 🎓');

    const uploadResult = await uploadToR2(testKey, testContent, {
      contentType: 'text/plain',
    });

    console.log('✅ Upload successful!');
    console.log(`   Key: ${uploadResult.key}`);
    console.log(`   URL: ${uploadResult.url}`);
    console.log(`   Size: ${uploadResult.size} bytes\n`);

    // Test 2: File Exists
    console.log('2️⃣ Testing File Exists...');
    const exists = await fileExistsInR2(testKey);
    console.log(`✅ File exists: ${exists}\n`);

    // Test 3: Download
    console.log('3️⃣ Testing Download...');
    const downloaded = await downloadFromR2(testKey);
    console.log('✅ Download successful!');
    console.log(`   Content: ${downloaded.toString()}\n`);

    // Test 4: List Files
    console.log('4️⃣ Testing List Files...');
    const files = await listR2Files('test/');
    console.log(`✅ Found ${files.length} file(s) in test/ folder:`);
    files.forEach(file => console.log(`   - ${file}`));
    console.log('');

    // Test 5: Delete
    console.log('5️⃣ Testing Delete...');
    await deleteFromR2(testKey);
    console.log('✅ Delete successful!\n');

    // Test 6: Verify Deletion
    console.log('6️⃣ Verifying Deletion...');
    const stillExists = await fileExistsInR2(testKey);
    console.log(`✅ File exists after deletion: ${stillExists}\n`);

    console.log('🎉 All tests passed! R2 is working correctly.\n');
    console.log('✅ You can now proceed with the implementation.');

  } catch (error: any) {
    console.error('❌ Test failed!');
    console.error('Error:', error.message);
    console.error('\n📝 Troubleshooting:');
    console.error('1. Check .env.local has R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    console.error('2. Verify R2 API token has "Object Read & Write" permissions');
    console.error('3. Ensure bucket name is correct: profbarral-documents');
    console.error('4. Check CORS is configured in R2 dashboard');
    process.exit(1);
  }
}

testR2Connection();
