const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.document.deleteMany({
    where: {
      courseId: '1',
      type: 'link'
    }
  });
  console.log(`🗑️ Removidos ${result.count} links de documentos`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
