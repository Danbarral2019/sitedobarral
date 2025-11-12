/**
 * PoC: Gemini File Search
 *
 * Tests the quality and capabilities of Google Gemini File API for:
 * - Document upload and indexation
 * - Semantic search
 * - Q&A capabilities
 * - Performance metrics
 *
 * Usage: npx tsx scripts/poc-gemini-file-search.ts [pdf-file-path]
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';

// ===========================
// Configuration
// ===========================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);

// Test queries to evaluate semantic search quality
const TEST_QUERIES = [
  {
    category: 'Semantic Search',
    question: 'Quais são os principais requisitos para licitação?',
    expectedKeywords: ['licitação', 'requisitos', 'processo', 'edital'],
  },
  {
    category: 'Factual Retrieval',
    question: 'Qual é o prazo para recursos?',
    expectedKeywords: ['prazo', 'recurso', 'dias'],
  },
  {
    category: 'Complex Understanding',
    question: 'Compare os tipos de licitação mencionados no documento.',
    expectedKeywords: ['tipos', 'comparação', 'diferença'],
  },
  {
    category: 'Contextual Q&A',
    question: 'O que acontece se houver descumprimento de contrato?',
    expectedKeywords: ['descumprimento', 'sanção', 'penalidade', 'contrato'],
  },
];

// ===========================
// Types
// ===========================

interface TestResult {
  query: string;
  category: string;
  response: string;
  latencyMs: number;
  relevanceScore: number;
  keywordsFound: string[];
  keywordsMissed: string[];
}

interface PoCReport {
  fileName: string;
  fileSize: number;
  uploadTimeMs: number;
  processingTimeMs: number;
  geminiFileId: string;
  testResults: TestResult[];
  averageLatency: number;
  averageRelevance: number;
  overallScore: number;
  recommendations: string[];
}

// ===========================
// Helper Functions
// ===========================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function calculateRelevance(response: string, expectedKeywords: string[]): {
  score: number;
  found: string[];
  missed: string[];
} {
  const responseLower = response.toLowerCase();
  const found: string[] = [];
  const missed: string[] = [];

  for (const keyword of expectedKeywords) {
    if (responseLower.includes(keyword.toLowerCase())) {
      found.push(keyword);
    } else {
      missed.push(keyword);
    }
  }

  const score = found.length / expectedKeywords.length;
  return { score, found, missed };
}

function calculateOverallScore(results: TestResult[]): number {
  if (results.length === 0) return 0;

  const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;

  // Score formula:
  // - 70% weight on relevance (0-100)
  // - 30% weight on latency (inverted: faster = better)
  const relevanceScore = avgRelevance * 100 * 0.7;
  const latencyScore = Math.max(0, 100 - (avgLatency / 50)) * 0.3; // 5s = 0 points

  return Math.round(relevanceScore + latencyScore);
}

function generateRecommendations(report: PoCReport): string[] {
  const recommendations: string[] = [];

  if (report.averageRelevance < 0.6) {
    recommendations.push('⚠️  Baixa relevância detectada. Considere melhorar prompts ou usar embeddings customizados.');
  }

  if (report.averageLatency > 3000) {
    recommendations.push('⚠️  Latência alta. Considere implementar cache ou pré-processamento.');
  }

  if (report.overallScore >= 80) {
    recommendations.push('✅ Excelente qualidade! Sistema pronto para produção.');
  } else if (report.overallScore >= 60) {
    recommendations.push('⚠️  Qualidade aceitável, mas pode ser melhorada.');
  } else {
    recommendations.push('❌ Qualidade insuficiente. Revise estratégia de indexação.');
  }

  return recommendations;
}

// ===========================
// Main PoC Logic
// ===========================

async function uploadFileToGemini(filePath: string): Promise<{
  fileId: string;
  fileName: string;
  uploadTimeMs: number;
  processingTimeMs: number;
}> {
  console.log(`📤 Uploading file to Gemini: ${path.basename(filePath)}`);

  const uploadStart = Date.now();

  // Upload file
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType: 'application/pdf',
    displayName: path.basename(filePath),
  });

  const uploadTimeMs = Date.now() - uploadStart;
  console.log(`✅ Upload completed in ${uploadTimeMs}ms`);
  console.log(`   File ID: ${uploadResult.file.name}`);

  // Wait for processing
  console.log('⏳ Waiting for Gemini to process file...');
  const processingStart = Date.now();

  let file = await fileManager.getFile(uploadResult.file.name);

  while (file.state === FileState.PROCESSING) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await fileManager.getFile(uploadResult.file.name);
    console.log(`   Status: ${file.state}`);
  }

  const processingTimeMs = Date.now() - processingStart;

  if (file.state === FileState.FAILED) {
    throw new Error('File processing failed');
  }

  console.log(`✅ Processing completed in ${processingTimeMs}ms`);
  console.log(`   State: ${file.state}`);

  return {
    fileId: uploadResult.file.uri, // Full URI for generateContent
    fileName: uploadResult.file.name, // Name for deletion (files/xxxxx)
    uploadTimeMs,
    processingTimeMs,
  };
}

async function runTestQuery(
  fileId: string,
  query: string,
  category: string,
  expectedKeywords: string[]
): Promise<TestResult> {
  console.log(`\n🔍 Testing: ${category}`);
  console.log(`   Query: "${query}"`);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const queryStart = Date.now();

  const result = await model.generateContent([
    {
      fileData: {
        mimeType: 'application/pdf',
        fileUri: fileId,
      },
    },
    { text: query },
  ]);

  const latencyMs = Date.now() - queryStart;
  const response = result.response.text();

  const { score, found, missed } = calculateRelevance(response, expectedKeywords);

  console.log(`   ⏱️  Latency: ${latencyMs}ms`);
  console.log(`   📊 Relevance: ${(score * 100).toFixed(1)}%`);
  console.log(`   ✅ Keywords found: ${found.join(', ')}`);
  if (missed.length > 0) {
    console.log(`   ❌ Keywords missed: ${missed.join(', ')}`);
  }

  return {
    query,
    category,
    response,
    latencyMs,
    relevanceScore: score,
    keywordsFound: found,
    keywordsMissed: missed,
  };
}

async function runPoC(filePath: string): Promise<PoCReport> {
  console.log('\n🔬 ========================================');
  console.log('   GEMINI FILE SEARCH - PoC');
  console.log('========================================\n');

  // 1. Validate file
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  console.log(`📄 File: ${path.basename(filePath)}`);
  console.log(`   Size: ${formatBytes(stats.size)}`);
  console.log(`   Path: ${filePath}\n`);

  // 2. Upload to Gemini
  const { fileId, fileName, uploadTimeMs, processingTimeMs } = await uploadFileToGemini(filePath);

  // 3. Run test queries
  console.log('\n📝 Running test queries...\n');
  console.log('═'.repeat(50));

  const testResults: TestResult[] = [];

  for (const testQuery of TEST_QUERIES) {
    const result = await runTestQuery(
      fileId,
      testQuery.question,
      testQuery.category,
      testQuery.expectedKeywords
    );
    testResults.push(result);
  }

  // 4. Calculate metrics
  const averageLatency = testResults.reduce((sum, r) => sum + r.latencyMs, 0) / testResults.length;
  const averageRelevance = testResults.reduce((sum, r) => sum + r.relevanceScore, 0) / testResults.length;
  const overallScore = calculateOverallScore(testResults);

  const report: PoCReport = {
    fileName: path.basename(filePath),
    fileSize: stats.size,
    uploadTimeMs,
    processingTimeMs,
    geminiFileId: fileId,
    testResults,
    averageLatency,
    averageRelevance,
    overallScore,
    recommendations: [],
  };

  report.recommendations = generateRecommendations(report);

  // 5. Cleanup: Delete file from Gemini
  console.log(`\n🧹 Cleaning up: Deleting file from Gemini...`);
  await fileManager.deleteFile(fileName); // Use fileName (files/xxxxx) for deletion
  console.log('✅ File deleted');

  return report;
}

function printReport(report: PoCReport): void {
  console.log('\n\n📊 ========================================');
  console.log('   PoC REPORT');
  console.log('========================================\n');

  console.log(`📄 File: ${report.fileName} (${formatBytes(report.fileSize)})`);
  console.log(`📤 Upload Time: ${report.uploadTimeMs}ms`);
  console.log(`⚙️  Processing Time: ${report.processingTimeMs}ms`);
  console.log(`🆔 Gemini File ID: ${report.geminiFileId}\n`);

  console.log('📈 PERFORMANCE METRICS');
  console.log('─'.repeat(50));
  console.log(`⏱️  Average Latency: ${report.averageLatency.toFixed(0)}ms`);
  console.log(`📊 Average Relevance: ${(report.averageRelevance * 100).toFixed(1)}%`);
  console.log(`🎯 Overall Score: ${report.overallScore}/100\n`);

  console.log('🔍 TEST RESULTS');
  console.log('─'.repeat(50));
  report.testResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.category}`);
    console.log(`   Query: "${result.query}"`);
    console.log(`   Latency: ${result.latencyMs}ms`);
    console.log(`   Relevance: ${(result.relevanceScore * 100).toFixed(1)}%`);
    console.log(`   Keywords Found: ${result.keywordsFound.length}/${result.keywordsFound.length + result.keywordsMissed.length}`);
    console.log(`   Response Preview: ${result.response.substring(0, 150)}...`);
  });

  console.log('\n\n💡 RECOMMENDATIONS');
  console.log('─'.repeat(50));
  report.recommendations.forEach((rec) => {
    console.log(rec);
  });

  console.log('\n✅ PoC completed successfully!\n');
}

// ===========================
// CLI Entry Point
// ===========================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/poc-gemini-file-search.ts <pdf-file-path>');
    console.error('\nExample:');
    console.error('  npx tsx scripts/poc-gemini-file-search.ts ./public/documents/lei-14133.pdf');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);

  try {
    const report = await runPoC(filePath);
    printReport(report);

    // Save report to JSON
    const reportPath = path.join(
      __dirname,
      `../poc-reports/gemini-file-search-${Date.now()}.json`
    );

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📁 Report saved to: ${reportPath}\n`);

    // Exit with appropriate code
    process.exit(report.overallScore >= 60 ? 0 : 1);
  } catch (error) {
    console.error('\n❌ PoC failed:', error);
    process.exit(1);
  }
}

main();
