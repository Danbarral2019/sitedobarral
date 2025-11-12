import { prisma } from '../lib/prisma';

async function checkPendingJobs() {
  console.log('\n🔍 Checking for pending IndexJobs and unindexed documents...\n');

  // Check pending jobs
  const pendingJobs = await prisma.indexJob.findMany({
    where: { status: 'pending' },
    take: 10,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  console.log(`📋 Pending IndexJobs: ${pendingJobs.length}`);
  if (pendingJobs.length > 0) {
    console.log('\nPending jobs:');
    pendingJobs.forEach((job, i) => {
      console.log(`  ${i + 1}. ${job.entityType} (${job.entityId}) - Priority: ${job.priority}`);
    });
  }

  // Check unindexed documents with R2 keys
  const unindexedDocs = await prisma.document.findMany({
    where: {
      geminiIndexed: false,
      r2Key: { not: null },
    },
    take: 10,
    select: {
      id: true,
      title: true,
      r2Key: true,
      type: true,
    },
    orderBy: { uploadedAt: 'desc' },
  });

  console.log(`\n📄 Documents not indexed (with R2 key): ${unindexedDocs.length}`);
  if (unindexedDocs.length > 0) {
    console.log('\nUnindexed documents:');
    unindexedDocs.forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.title} (${doc.type})`);
      console.log(`     ID: ${doc.id}`);
      console.log(`     R2: ${doc.r2Key}`);
    });
  }

  // Check documents with Gemini IDs
  const indexedDocs = await prisma.document.count({
    where: { geminiIndexed: true },
  });

  console.log(`\n✅ Documents already indexed: ${indexedDocs}`);

  await prisma.$disconnect();
}

checkPendingJobs().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
