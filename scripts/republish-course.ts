import { prisma } from '../lib/prisma';

async function main() {
  const courseId = process.argv[2];
  if (!courseId) {
    console.error('Uso: tsx scripts/republish-course.ts <courseId>');
    console.error('Exemplo: tsx scripts/republish-course.ts 10');
    process.exit(1);
  }

  const status = await prisma.courseStatus.findUnique({ where: { courseId } });
  if (!status) {
    console.log(`Curso ${courseId} não tem CourseStatus registrado — nada a fazer (já está visível).`);
    await prisma.$disconnect();
    return;
  }

  if (!status.isSuspended) {
    console.log(`Curso ${courseId} já estava ativo (isSuspended=false). Nada a fazer.`);
    await prisma.$disconnect();
    return;
  }

  await prisma.courseStatus.update({
    where: { courseId },
    data: {
      isSuspended: false,
      suspensionReason: null,
      plannedReturn: null,
    },
  });

  console.log(`✅ Curso ${courseId} republicado. Banner desligado, conteúdo das aulas volta a aparecer.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
