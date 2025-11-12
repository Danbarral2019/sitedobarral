/**
 * Cache Performance Test
 *
 * Compares Gemini query performance with and without Redis cache
 *
 * Expected results:
 * - First query (cold): ~4-5 seconds
 * - Cached query (warm): ~100-200ms
 * - Performance improvement: ~95%
 *
 * Usage: npx tsx scripts/test-cache-performance.ts
 */

import { queryGeminiWithFile } from '../lib/gemini/cached-client';
import { healthCheck } from '../lib/cache/redis-client';
import { prisma } from '../lib/prisma';

// ===========================
// Configuration
// ===========================

const TEST_QUERIES = [
  'Qual é o assunto principal deste documento?',
  'Liste os pontos mais importantes mencionados',
  'Este documento trata de licitações?',
];

// ===========================
// Helper Functions
// ===========================

function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatImprovement(before: number, after: number): string {
  const improvement = ((before - after) / before) * 100;
  return `${improvement.toFixed(1)}%`;
}

// ===========================
// Main Test
// ===========================

async function runPerformanceTest() {
  console.log('\n🔬 ========================================');
  console.log('   CACHE PERFORMANCE TEST');
  console.log('========================================\n');

  // 1. Check Redis connection
  console.log('📡 Checking Redis connection...');
  const health = await healthCheck();

  if (!health.connected) {
    console.error('❌ Redis not connected:', health.error);
    console.log('\n💡 To enable caching:');
    console.log('   1. Create account at https://console.upstash.com/');
    console.log('   2. Create Redis database');
    console.log('   3. Add credentials to .env.local:');
    console.log('      UPSTASH_REDIS_REST_URL=https://...');
    console.log('      UPSTASH_REDIS_REST_TOKEN=...');
    console.log('\n⚠️  Running tests WITHOUT cache...\n');
  } else {
    console.log(`✅ Redis connected (latency: ${health.latency}ms)\n`);
  }

  // 2. Get most recent document from R2
  console.log('📄 Fetching test document...');
  const document = await prisma.document.findFirst({
    where: {
      r2Key: { not: null },
      geminiFileId: { not: null },
    },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      title: true,
      geminiFileId: true,
    },
  });

  if (!document || !document.geminiFileId) {
    console.error('❌ No indexed document found');
    console.log('\n💡 Upload a document first:');
    console.log('   1. Go to http://localhost:3000/admin/test-upload-ui');
    console.log('   2. Upload a PDF');
    console.log('   3. Wait for indexation job to complete');
    process.exit(1);
  }

  console.log(`✅ Using document: ${document.title}`);
  console.log(`   Gemini File ID: ${document.geminiFileId}\n`);

  // 3. Run test queries
  console.log('🏃 Running test queries...\n');
  console.log('═'.repeat(60));

  const results: Array<{
    query: string;
    coldLatency: number;
    warmLatency: number;
    improvement: string;
  }> = [];

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];

    console.log(`\n${i + 1}. Query: "${query}"`);

    // First query (cold - populates cache)
    console.log('   🥶 Cold query (populating cache)...');
    const coldResult = await queryGeminiWithFile(document.geminiFileId, query, {
      useCache: true, // Changed to true to populate cache
    });

    console.log(`      ⏱️  Latency: ${formatLatency(coldResult.latency)}`);
    console.log(`      📝 Response: ${coldResult.response.substring(0, 80)}...`);

    // Second query (warm - should hit cache)
    console.log('   🔥 Warm query (with cache)...');
    const warmResult = await queryGeminiWithFile(document.geminiFileId, query, {
      useCache: true,
    });

    console.log(`      ⏱️  Latency: ${formatLatency(warmResult.latency)}`);
    console.log(`      💾 Cached: ${warmResult.cached ? 'YES ✅' : 'NO ❌'}`);
    console.log(`      ⚡ Speedup: ${formatImprovement(coldResult.latency, warmResult.latency)}`);

    results.push({
      query,
      coldLatency: coldResult.latency,
      warmLatency: warmResult.latency,
      improvement: formatImprovement(coldResult.latency, warmResult.latency),
    });

    // Small delay between queries
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 4. Calculate overall statistics
  console.log('\n\n📊 ========================================');
  console.log('   PERFORMANCE SUMMARY');
  console.log('========================================\n');

  const avgCold =
    results.reduce((sum, r) => sum + r.coldLatency, 0) / results.length;
  const avgWarm =
    results.reduce((sum, r) => sum + r.warmLatency, 0) / results.length;
  const avgImprovement = formatImprovement(avgCold, avgWarm);

  console.log('📈 Average Performance:');
  console.log(`   🥶 Cold (no cache): ${formatLatency(avgCold)}`);
  console.log(`   🔥 Warm (cached):   ${formatLatency(avgWarm)}`);
  console.log(`   ⚡ Improvement:     ${avgImprovement} faster`);
  console.log('');

  console.log('🎯 Individual Results:');
  console.log('─'.repeat(60));
  results.forEach((result, i) => {
    console.log(`${i + 1}. ${result.query.substring(0, 40)}...`);
    console.log(
      `   Cold: ${formatLatency(result.coldLatency)} | Warm: ${formatLatency(result.warmLatency)} | Speedup: ${result.improvement}`
    );
  });

  console.log('');

  // 5. Recommendations
  console.log('💡 RECOMMENDATIONS');
  console.log('─'.repeat(60));

  if (!health.connected) {
    console.log('❌ Redis not configured - enable caching for better performance!');
    console.log('   Expected improvement: ~95% faster (5s → 250ms)');
  } else if (avgWarm < 500) {
    console.log('✅ Excellent! Cache is working perfectly.');
    console.log(`   Achieved ${avgImprovement} speedup`);
  } else if (avgWarm < 1000) {
    console.log('⚠️  Cache is working but latency is still high.');
    console.log('   Consider using a Redis instance closer to your server.');
  } else {
    console.log('❌ Cache not providing expected speedup.');
    console.log('   Check Redis configuration and network latency.');
  }

  console.log('\n✅ Performance test completed!\n');
}

// ===========================
// Entry Point
// ===========================

runPerformanceTest()
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
