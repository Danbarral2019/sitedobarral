/**
 * Limpeza de dados de cursos removidos
 *
 * Remove TODOS os dados associados aos cursos com IDs '1', '5' e '6' que
 * foram descontinuados. Respeita foreign keys deletando na ordem correta.
 *
 * Curso ID '1' = "Nova Lei de Licitacoes" (antigo)
 * Curso ID '5' e '6' = cursos removidos
 *
 * IMPORTANTE:
 * - NÃO deleta documentos com isCommon=true (compartilhados entre cursos)
 * - NÃO deleta documentos com courseId=NULL (são globais)
 * - Usa transacao Prisma para atomicidade
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/cleanup-removed-courses.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COURSE_IDS_TO_REMOVE = ['1', '5', '6'];

async function main() {
  console.log('=================================================================');
  console.log('   LIMPEZA DE DADOS - CURSOS REMOVIDOS (IDs: 1, 5, 6)');
  console.log('=================================================================');
  console.log('');

  // ---------------------------------------------------------------------------
  // FASE 1: Contagem antes da limpeza (para relatorio)
  // ---------------------------------------------------------------------------
  console.log('--- Contagem ANTES da limpeza ---\n');

  // Encontrar modulos dos cursos
  const modules = await prisma.module.findMany({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
    select: { id: true, courseId: true, title: true },
  });
  const moduleIds = modules.map((m) => m.id);
  console.log(`Modules:        ${modules.length}`);
  for (const m of modules) {
    console.log(`  - [course ${m.courseId}] ${m.title}`);
  }

  // Encontrar licoes desses modulos
  const lessons = await prisma.lesson.findMany({
    where: { moduleId: { in: moduleIds } },
    select: { id: true, title: true },
  });
  const lessonIds = lessons.map((l) => l.id);
  console.log(`Lessons:        ${lessons.length}`);

  // Encontrar quizzes dessas licoes
  const quizzes = await prisma.quiz.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true },
  });
  const quizIds = quizzes.map((q) => q.id);
  console.log(`Quizzes:        ${quizzes.length}`);

  // Contar quiz questions
  const quizQuestionCount = await prisma.quizQuestion.count({
    where: { quizId: { in: quizIds } },
  });
  console.log(`QuizQuestions:  ${quizQuestionCount}`);

  // Contar quiz attempts
  const quizAttemptCount = await prisma.quizAttempt.count({
    where: { quizId: { in: quizIds } },
  });
  console.log(`QuizAttempts:   ${quizAttemptCount}`);

  // Contar lesson progress
  const lessonProgressCount = await prisma.lessonProgress.count({
    where: { lessonId: { in: lessonIds } },
  });
  console.log(`LessonProgress: ${lessonProgressCount}`);

  // Contar lesson comments (discussao)
  const lessonCommentCount = await prisma.lessonComment.count({
    where: { lessonId: { in: lessonIds } },
  });
  console.log(`LessonComments: ${lessonCommentCount}`);

  // Contar lesson documents (junction)
  const lessonDocCount = await prisma.lessonDocument.count({
    where: { lessonId: { in: lessonIds } },
  });
  console.log(`LessonDocuments: ${lessonDocCount}`);

  // Contar lesson videos (junction)
  const lessonVideoCount = await prisma.lessonVideo.count({
    where: { lessonId: { in: lessonIds } },
  });
  console.log(`LessonVideos:   ${lessonVideoCount}`);

  // Contar enrollments
  const enrollmentCount = await prisma.enrollment.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`Enrollments:    ${enrollmentCount}`);

  // Contar documentos (NAO isCommon, com courseId nesses cursos)
  const documentCount = await prisma.document.count({
    where: {
      courseId: { in: COURSE_IDS_TO_REMOVE },
      isCommon: false,
    },
  });
  console.log(`Documents:      ${documentCount} (excluindo isCommon=true)`);

  // Contar SiteToCourse
  const siteToCourseCount = await prisma.siteToCourse.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`SiteToCourse:   ${siteToCourseCount}`);

  // Contar CourseVideo
  const courseVideoCount = await prisma.courseVideo.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`CourseVideos:   ${courseVideoCount}`);

  // Contar Certificates
  const certificateCount = await prisma.certificate.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`Certificates:   ${certificateCount}`);

  // Contar Badges
  const badgeCount = await prisma.badge.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`Badges:         ${badgeCount}`);

  // Contar UserStreak
  const userStreakCount = await prisma.userStreak.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`UserStreaks:     ${userStreakCount}`);

  // Contar QRCode
  const qrCodeCount = await prisma.qRCode.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`QRCodes:        ${qrCodeCount}`);

  // Contar AccessLogs
  const accessLogCount = await prisma.accessLog.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`AccessLogs:     ${accessLogCount}`);

  // Contar Favorites
  const favoriteCount = await prisma.favorite.count({
    where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
  });
  console.log(`Favorites:      ${favoriteCount}`);

  const totalRecords =
    quizQuestionCount +
    quizAttemptCount +
    quizzes.length +
    lessonProgressCount +
    lessonCommentCount +
    lessonDocCount +
    lessonVideoCount +
    lessons.length +
    modules.length +
    enrollmentCount +
    documentCount +
    siteToCourseCount +
    courseVideoCount +
    certificateCount +
    badgeCount +
    userStreakCount +
    qrCodeCount +
    accessLogCount +
    favoriteCount;

  console.log(`\nTOTAL DE REGISTROS A DELETAR: ${totalRecords}\n`);

  if (totalRecords === 0) {
    console.log('Nenhum registro encontrado para esses cursos. Nada a fazer.');
    return;
  }

  // ---------------------------------------------------------------------------
  // FASE 2: Deletar em transacao (respeitando foreign keys)
  // ---------------------------------------------------------------------------
  console.log('--- Iniciando delecao em transacao ---\n');

  const result = await prisma.$transaction(async (tx) => {
    const deleted: Record<string, number> = {};

    // 1. QuizAttempts (references Quiz)
    if (quizIds.length > 0) {
      const r = await tx.quizAttempt.deleteMany({
        where: { quizId: { in: quizIds } },
      });
      deleted['QuizAttempt'] = r.count;
      console.log(`  [1/16] QuizAttempt:     ${r.count} deletados`);
    } else {
      deleted['QuizAttempt'] = 0;
      console.log(`  [1/16] QuizAttempt:     0 (sem quizzes)`);
    }

    // 2. QuizQuestion (references Quiz)
    if (quizIds.length > 0) {
      const r = await tx.quizQuestion.deleteMany({
        where: { quizId: { in: quizIds } },
      });
      deleted['QuizQuestion'] = r.count;
      console.log(`  [2/16] QuizQuestion:    ${r.count} deletados`);
    } else {
      deleted['QuizQuestion'] = 0;
      console.log(`  [2/16] QuizQuestion:    0 (sem quizzes)`);
    }

    // 3. Quiz (references Lesson)
    if (lessonIds.length > 0) {
      const r = await tx.quiz.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
      deleted['Quiz'] = r.count;
      console.log(`  [3/16] Quiz:            ${r.count} deletados`);
    } else {
      deleted['Quiz'] = 0;
      console.log(`  [3/16] Quiz:            0 (sem lessons)`);
    }

    // 4. LessonProgress (references Lesson)
    if (lessonIds.length > 0) {
      const r = await tx.lessonProgress.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
      deleted['LessonProgress'] = r.count;
      console.log(`  [4/16] LessonProgress:  ${r.count} deletados`);
    } else {
      deleted['LessonProgress'] = 0;
      console.log(`  [4/16] LessonProgress:  0 (sem lessons)`);
    }

    // 5. LessonComment (discussao - self-referential, cascade handles replies)
    if (lessonIds.length > 0) {
      // Delete replies first (parentId NOT NULL), then root comments
      const replies = await tx.lessonComment.deleteMany({
        where: {
          lessonId: { in: lessonIds },
          parentId: { not: null },
        },
      });
      const roots = await tx.lessonComment.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
      deleted['LessonComment'] = replies.count + roots.count;
      console.log(`  [5/16] LessonComment:   ${replies.count + roots.count} deletados (${replies.count} replies + ${roots.count} root)`);
    } else {
      deleted['LessonComment'] = 0;
      console.log(`  [5/16] LessonComment:   0 (sem lessons)`);
    }

    // 6. LessonDocument (junction Lesson<->Document)
    if (lessonIds.length > 0) {
      const r = await tx.lessonDocument.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
      deleted['LessonDocument'] = r.count;
      console.log(`  [6/16] LessonDocument:  ${r.count} deletados`);
    } else {
      deleted['LessonDocument'] = 0;
      console.log(`  [6/16] LessonDocument:  0 (sem lessons)`);
    }

    // 7. LessonVideo (junction Lesson<->Video)
    if (lessonIds.length > 0) {
      const r = await tx.lessonVideo.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
      deleted['LessonVideo'] = r.count;
      console.log(`  [7/16] LessonVideo:     ${r.count} deletados`);
    } else {
      deleted['LessonVideo'] = 0;
      console.log(`  [7/16] LessonVideo:     0 (sem lessons)`);
    }

    // 8. Lesson (references Module, cascade deletes handled above)
    if (moduleIds.length > 0) {
      const r = await tx.lesson.deleteMany({
        where: { moduleId: { in: moduleIds } },
      });
      deleted['Lesson'] = r.count;
      console.log(`  [8/16] Lesson:          ${r.count} deletados`);
    } else {
      deleted['Lesson'] = 0;
      console.log(`  [8/16] Lesson:          0 (sem modules)`);
    }

    // 9. Module (references courseId)
    {
      const r = await tx.module.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['Module'] = r.count;
      console.log(`  [9/16] Module:          ${r.count} deletados`);
    }

    // 10. Enrollment
    {
      const r = await tx.enrollment.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['Enrollment'] = r.count;
      console.log(`  [10/16] Enrollment:     ${r.count} deletados`);
    }

    // 11. Document (NAO isCommon, courseId nesses cursos)
    // Primeiro, deletar DocumentChunks e DocumentVersions dos docs a serem removidos
    // (cascade deveria cuidar, mas vamos ser explicitos)
    {
      const docsToDelete = await tx.document.findMany({
        where: {
          courseId: { in: COURSE_IDS_TO_REMOVE },
          isCommon: false,
        },
        select: { id: true },
      });
      const docIds = docsToDelete.map((d) => d.id);

      if (docIds.length > 0) {
        // Delete related records first (DocumentChunk, DocumentVersion, Favorite, LessonDocument, TcuHighlight)
        const chunks = await tx.documentChunk.deleteMany({
          where: { documentId: { in: docIds } },
        });
        console.log(`         -> DocumentChunk:   ${chunks.count} chunks deletados`);

        const versions = await tx.documentVersion.deleteMany({
          where: { documentId: { in: docIds } },
        });
        console.log(`         -> DocumentVersion: ${versions.count} versions deletadas`);

        const highlights = await tx.tcuHighlight.deleteMany({
          where: { documentId: { in: docIds } },
        });
        console.log(`         -> TcuHighlight:    ${highlights.count} highlights deletados`);

        // Favorites que referenciam esses documentos
        const favs = await tx.favorite.deleteMany({
          where: { documentId: { in: docIds } },
        });
        console.log(`         -> Favorite (docs): ${favs.count} favoritos deletados`);
      }

      const r = await tx.document.deleteMany({
        where: {
          courseId: { in: COURSE_IDS_TO_REMOVE },
          isCommon: false,
        },
      });
      deleted['Document'] = r.count;
      console.log(`  [11/16] Document:       ${r.count} deletados (excl. isCommon)`);
    }

    // 12. SiteToCourse
    {
      const r = await tx.siteToCourse.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['SiteToCourse'] = r.count;
      console.log(`  [12/16] SiteToCourse:   ${r.count} deletados`);
    }

    // 13. CourseVideo (e LessonVideos que referenciam esses CourseVideos)
    {
      // Primeiro buscar courseVideoIds para limpar LessonVideo references
      const cvs = await tx.courseVideo.findMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
        select: { id: true },
      });
      // LessonVideos que referenciam esses CourseVideos ja foram deletados no passo 7
      // (via lessonId), mas pode haver orphans de outros cursos - nao tocar nesses

      const r = await tx.courseVideo.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['CourseVideo'] = r.count;
      console.log(`  [13/16] CourseVideo:     ${r.count} deletados`);
    }

    // 14. Certificate
    {
      const r = await tx.certificate.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['Certificate'] = r.count;
      console.log(`  [14/16] Certificate:    ${r.count} deletados`);
    }

    // 15. Badge (courseId pode ser null, deletar apenas os que tem courseId nos cursos)
    {
      const r = await tx.badge.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['Badge'] = r.count;
      console.log(`  [15/16] Badge:          ${r.count} deletados`);
    }

    // 16. UserStreak
    {
      const r = await tx.userStreak.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['UserStreak'] = r.count;
      console.log(`  [16/16] UserStreak:     ${r.count} deletados`);
    }

    // EXTRA: QRCode
    {
      const r = await tx.qRCode.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['QRCode'] = r.count;
      console.log(`  [EXTRA] QRCode:         ${r.count} deletados`);
    }

    // EXTRA: AccessLog (courseId desses cursos)
    {
      const r = await tx.accessLog.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['AccessLog'] = r.count;
      console.log(`  [EXTRA] AccessLog:      ${r.count} deletados`);
    }

    // EXTRA: Favorite (com courseId desses cursos, nao ja deletados com docs)
    {
      const r = await tx.favorite.deleteMany({
        where: { courseId: { in: COURSE_IDS_TO_REMOVE } },
      });
      deleted['Favorite'] = r.count;
      console.log(`  [EXTRA] Favorite:       ${r.count} deletados`);
    }

    return deleted;
  }, {
    timeout: 60000, // 60s timeout para transacao grande
  });

  // ---------------------------------------------------------------------------
  // FASE 3: Relatorio final
  // ---------------------------------------------------------------------------
  console.log('\n=================================================================');
  console.log('   RELATORIO FINAL');
  console.log('=================================================================\n');

  let totalDeleted = 0;
  for (const [table, count] of Object.entries(result)) {
    if (count > 0) {
      console.log(`  ${table.padEnd(20)} ${count} registros`);
    }
    totalDeleted += count;
  }

  console.log(`\n  TOTAL DELETADO:       ${totalDeleted} registros`);
  console.log('\n  Cursos removidos: IDs 1, 5, 6');
  console.log('  Documentos isCommon:  PRESERVADOS');
  console.log('  Outros cursos:        INTACTOS');
  console.log('\n  Limpeza concluida com sucesso!');
}

main()
  .catch((e) => {
    console.error('\nERRO durante a limpeza:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
