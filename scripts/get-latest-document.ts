import { prisma } from '../lib/prisma';

async function main() {
  const doc = await prisma.document.findFirst({
    where: {
      r2Key: { not: null },
    },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      title: true,
      r2Key: true,
      size: true,
      uploadedAt: true,
      url: true,
    },
  });

  if (!doc) {
    console.log('No documents found with R2 key');
    process.exit(1);
  }

  console.log(JSON.stringify(doc, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
