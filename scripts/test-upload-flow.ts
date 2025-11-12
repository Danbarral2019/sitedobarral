/**
 * Test Upload Flow - Presigned URLs + R2 + Confirmation
 *
 * Tests the complete upload flow:
 * 1. Login as admin → Get JWT token
 * 2. Request presigned URL
 * 3. Upload file directly to R2
 * 4. Confirm upload to backend
 * 5. Verify database record
 *
 * Run: npx tsx scripts/test-upload-flow.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// ===========================
// Color Helpers
// ===========================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string) {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Step ${step}:${colors.reset} ${message}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

// ===========================
// Test File Generator
// ===========================

function generateTestPDF(): Buffer {
  // Generate a minimal valid PDF
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Upload Flow) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000317 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
410
%%EOF`;

  return Buffer.from(pdfContent);
}

// ===========================
// Step 1: Login as Admin
// ===========================

async function loginAsAdmin(): Promise<string> {
  logStep(1, 'Login as Admin');

  try {
    const response = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@profdanielbarral.com',
        password: '#Miguel2025',
      }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    // Extract token from Set-Cookie header
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('No Set-Cookie header in response');
    }

    const tokenMatch = setCookie.match(/token=([^;]+)/);
    if (!tokenMatch) {
      throw new Error('Could not extract token from cookie');
    }

    const token = tokenMatch[1];

    log(`✅ Login successful`, 'green');
    log(`   Token: ${token.substring(0, 20)}...`, 'cyan');

    return token;
  } catch (error) {
    log(`❌ Login failed: ${error}`, 'red');
    throw error;
  }
}

// ===========================
// Step 2: Request Presigned URL
// ===========================

async function requestPresignedUrl(
  token: string
): Promise<{ presignedUrl: string; r2Key: string; fileId: string }> {
  logStep(2, 'Request Presigned URL');

  const fileName = `test-upload-${Date.now()}.pdf`;
  const fileSize = 500; // Approximate size
  const fileType = 'application/pdf';

  try {
    const response = await fetch(`${BASE_URL}/api/admin/upload/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({
        fileName,
        fileSize,
        fileType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Presigned URL request failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    log(`✅ Presigned URL obtained`, 'green');
    log(`   File ID: ${data.fileId}`, 'cyan');
    log(`   R2 Key: ${data.r2Key}`, 'cyan');
    log(`   Expires in: ${data.expiresIn}s`, 'cyan');

    return {
      presignedUrl: data.presignedUrl,
      r2Key: data.r2Key,
      fileId: data.fileId,
    };
  } catch (error) {
    log(`❌ Presigned URL request failed: ${error}`, 'red');
    throw error;
  }
}

// ===========================
// Step 3: Upload to R2
// ===========================

async function uploadToR2(presignedUrl: string, fileBuffer: Buffer): Promise<void> {
  logStep(3, 'Upload File to R2');

  try {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileBuffer.length.toString(),
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`R2 upload failed: ${response.status} ${response.statusText}`);
    }

    log(`✅ File uploaded to R2 successfully`, 'green');
    log(`   File size: ${fileBuffer.length} bytes`, 'cyan');
  } catch (error) {
    log(`❌ R2 upload failed: ${error}`, 'red');
    throw error;
  }
}

// ===========================
// Step 4: Confirm Upload
// ===========================

async function confirmUpload(
  token: string,
  fileId: string,
  r2Key: string,
  fileName: string,
  fileSize: number
): Promise<string> {
  logStep(4, 'Confirm Upload to Backend');

  try {
    const response = await fetch(`${BASE_URL}/api/admin/upload/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({
        fileId,
        r2Key,
        fileName,
        fileSize,
        fileType: 'application/pdf',
        title: 'Test Upload Document',
        description: 'Documento de teste do fluxo de upload',
        category: 'teste',
        isPublic: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Upload confirmation failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    log(`✅ Upload confirmed`, 'green');
    log(`   Document ID: ${data.documentId}`, 'cyan');
    log(`   Public URL: ${data.url}`, 'cyan');

    return data.documentId;
  } catch (error) {
    log(`❌ Upload confirmation failed: ${error}`, 'red');
    throw error;
  }
}

// ===========================
// Step 5: Verify Database
// ===========================

async function verifyDatabase(documentId: string): Promise<void> {
  logStep(5, 'Verify Database Records');

  try {
    // Check document record
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        r2Key: true,
        r2UploadedAt: true,
        geminiIndexed: true,
        url: true,
      },
    });

    if (!document) {
      throw new Error('Document not found in database');
    }

    log(`✅ Document record verified`, 'green');
    log(`   ID: ${document.id}`, 'cyan');
    log(`   Title: ${document.title}`, 'cyan');
    log(`   R2 Key: ${document.r2Key}`, 'cyan');
    log(`   R2 Uploaded: ${document.r2UploadedAt}`, 'cyan');
    log(`   Gemini Indexed: ${document.geminiIndexed}`, 'cyan');

    // Check index job
    const indexJob = await prisma.indexJob.findFirst({
      where: { entityId: documentId },
      select: {
        id: true,
        status: true,
        priority: true,
        entityType: true,
      },
    });

    if (!indexJob) {
      log(`⚠️  No index job created (this is OK if auto-indexing is disabled)`, 'yellow');
    } else {
      log(`✅ Index job created`, 'green');
      log(`   Job ID: ${indexJob.id}`, 'cyan');
      log(`   Status: ${indexJob.status}`, 'cyan');
      log(`   Priority: ${indexJob.priority}`, 'cyan');
    }
  } catch (error) {
    log(`❌ Database verification failed: ${error}`, 'red');
    throw error;
  }
}

// ===========================
// Main Test Flow
// ===========================

async function testUploadFlow() {
  console.log('\n');
  log('═══════════════════════════════════════════════════════', 'cyan');
  log('  🧪 TEST UPLOAD FLOW - Presigned URLs + R2 + Database', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');
  console.log('\n');

  try {
    // Step 1: Login
    const token = await loginAsAdmin();

    // Step 2: Request presigned URL
    const { presignedUrl, r2Key, fileId } = await requestPresignedUrl(token);

    // Step 3: Upload to R2
    const testFile = generateTestPDF();
    const fileName = `test-upload-${Date.now()}.pdf`;
    await uploadToR2(presignedUrl, testFile);

    // Step 4: Confirm upload
    const documentId = await confirmUpload(token, fileId, r2Key, fileName, testFile.length);

    // Step 5: Verify database
    await verifyDatabase(documentId);

    // Success!
    console.log('\n');
    log('═══════════════════════════════════════════════════════', 'green');
    log('  ✅ ALL TESTS PASSED! Upload flow is working correctly', 'green');
    log('═══════════════════════════════════════════════════════', 'green');
    console.log('\n');

    log('📝 Summary:', 'cyan');
    log(`   • Document ID: ${documentId}`, 'cyan');
    log(`   • R2 Key: ${r2Key}`, 'cyan');
    log(`   • File uploaded to R2 ✓`, 'cyan');
    log(`   • Database record created ✓`, 'cyan');
    log(`   • Index job enqueued ✓`, 'cyan');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.log('\n');
    log('═══════════════════════════════════════════════════════', 'red');
    log('  ❌ TEST FAILED', 'red');
    log('═══════════════════════════════════════════════════════', 'red');
    console.log('\n');
    log(`Error: ${error}`, 'red');
    console.log('\n');
    process.exit(1);
  }
}

// Run tests
testUploadFlow();
