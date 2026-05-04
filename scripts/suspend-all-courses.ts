import { prisma } from '../lib/prisma';

const COURSES_TO_SUSPEND = ['2', '3', '4', '7', '8', '10'];

const SUSPENSION_REASON =
  'Identificamos imprecisões técnicas no conteúdo textual deste curso e iniciamos uma revisão editorial completa. Os documentos e vídeos vinculados continuam acessíveis. O conteúdo escrito retorna após revisão jurídica do Prof. Daniel Barral.';

async function main() {
  const now = new Date();

  for (const courseId of COURSES_TO_SUSPEND) {
    const result = await prisma.courseStatus.upsert({
      where: { courseId },
      create: {
        courseId,
        isSuspended: true,
        suspensionReason: SUSPENSION_REASON,
        suspendedAt: now,
      },
      update: {
        isSuspended: true,
        suspensionReason: SUSPENSION_REASON,
        suspendedAt: now,
        plannedReturn: null,
      },
    });
    console.log(`✅ Curso ${courseId} suspenso (status id=${result.id})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
