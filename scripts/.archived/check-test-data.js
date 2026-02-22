const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.count({ where: { courseId: '1' } });
  const videos = await prisma.courseVideo.count({ where: { courseId: '1' } });
  const sites = await prisma.siteToCourse.count({ where: { courseId: '1' } });

  console.log('📊 Dados no Curso 1 (Nova Lei de Licitações):');
  console.log(`  📄 Documentos: ${docs}`);
  console.log(`  🎥 Vídeos: ${videos}`);
  console.log(`  🌐 Sites: ${sites}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
