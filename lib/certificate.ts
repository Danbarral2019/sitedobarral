import { prisma } from '@/lib/prisma';
import { getCourseById } from '@/lib/courses';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

/**
 * Verifica se o aluno completou todos os requisitos para certificado:
 * 1. 100% das aulas concluídas
 * 2. Todos os quizzes aprovados
 */
export async function checkCertificateEligibility(
  userId: string,
  courseId: string
): Promise<{
  eligible: boolean;
  totalLessons: number;
  completedLessons: number;
  totalQuizzes: number;
  passedQuizzes: number;
  existingCertificate: { id: string; certificateNumber: string; issuedAt: Date } | null;
}> {
  // Verificar se já tem certificado
  const existingCertificate = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, certificateNumber: true, issuedAt: true },
  });

  // Buscar todos os módulos + aulas do curso
  const modules = await prisma.module.findMany({
    where: { courseId, isPublished: true },
    include: {
      lessons: {
        where: { isPublished: true },
        include: {
          quiz: {
            select: { id: true, isPublished: true },
          },
        },
      },
    },
  });

  const allLessons = modules.flatMap(m => m.lessons);
  const totalLessons = allLessons.length;

  if (totalLessons === 0) {
    return {
      eligible: false,
      totalLessons: 0,
      completedLessons: 0,
      totalQuizzes: 0,
      passedQuizzes: 0,
      existingCertificate,
    };
  }

  // Verificar progresso das aulas
  const lessonIds = allLessons.map(l => l.id);
  const completedProgress = await prisma.lessonProgress.count({
    where: {
      userId,
      lessonId: { in: lessonIds },
      status: 'completed',
    },
  });

  // Verificar quizzes publicados
  const publishedQuizzes = allLessons
    .filter(l => l.quiz && l.quiz.isPublished)
    .map(l => l.quiz!);
  const totalQuizzes = publishedQuizzes.length;

  // Para cada quiz publicado, verificar se o aluno tem pelo menos 1 tentativa aprovada
  let passedQuizzes = 0;
  if (totalQuizzes > 0) {
    const quizIds = publishedQuizzes.map(q => q.id);
    const passedAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        quizId: { in: quizIds },
        passed: true,
      },
      distinct: ['quizId'],
      select: { quizId: true },
    });
    passedQuizzes = passedAttempts.length;
  }

  const eligible =
    completedProgress >= totalLessons &&
    passedQuizzes >= totalQuizzes;

  return {
    eligible,
    totalLessons,
    completedLessons: completedProgress,
    totalQuizzes,
    passedQuizzes,
    existingCertificate,
  };
}

/**
 * Gera número único de certificado: BARRAL-{ANO}-{SEQUÊNCIA 4 dígitos}
 */
export async function generateCertificateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BARRAL-${year}-`;

  // Buscar o maior número do ano atual
  const lastCert = await prisma.certificate.findFirst({
    where: {
      certificateNumber: { startsWith: prefix },
    },
    orderBy: { certificateNumber: 'desc' },
    select: { certificateNumber: true },
  });

  let sequence = 1;
  if (lastCert) {
    const lastSeq = parseInt(lastCert.certificateNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

/**
 * Emite um certificado para o aluno (se elegível e não tiver um)
 */
export async function issueCertificate(
  userId: string,
  courseId: string
): Promise<{
  certificate: { id: string; certificateNumber: string; issuedAt: Date } | null;
  alreadyExists: boolean;
}> {
  // Verificar se já existe
  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) {
    return { certificate: existing, alreadyExists: true };
  }

  // Buscar dados do aluno e curso
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) return { certificate: null, alreadyExists: false };

  const course = getCourseById(courseId);
  if (!course) return { certificate: null, alreadyExists: false };

  // Calcular carga horária estimada
  const modules = await prisma.module.findMany({
    where: { courseId, isPublished: true },
    include: {
      lessons: {
        where: { isPublished: true },
        select: { estimatedMinutes: true },
      },
    },
  });
  const totalMinutes = modules
    .flatMap(m => m.lessons)
    .reduce((sum, l) => sum + (l.estimatedMinutes || 0), 0);
  const estimatedHours = totalMinutes > 0 ? Math.ceil(totalMinutes / 60) : null;

  // Gerar número e criar certificado
  const certificateNumber = await generateCertificateNumber();

  const certificate = await prisma.certificate.create({
    data: {
      userId,
      courseId,
      certificateNumber,
      studentName: user.name,
      courseTitle: course.title,
      estimatedHours,
    },
  });

  apiLogger.info(
    { certificateId: certificate.id, userId, courseId, certificateNumber },
    'Certificate issued'
  );
  trackServerEvent('certificate_issued', { courseId });

  // Enviar email (fire-and-forget)
  sendCertificateEmailAsync(user.email, user.name, course.title, certificateNumber).catch(() => {});

  // Push notification (fire-and-forget)
  sendPushToUserAsync(userId, course.title).catch(() => {});

  return { certificate, alreadyExists: false };
}

/**
 * Verifica elegibilidade e emite certificado se aprovado
 */
export async function checkAndIssueCertificate(
  userId: string,
  courseId: string
) {
  const eligibility = await checkCertificateEligibility(userId, courseId);
  if (eligibility.eligible && !eligibility.existingCertificate) {
    return issueCertificate(userId, courseId);
  }
  return null;
}

/**
 * Envia email de certificado (async, não bloqueia)
 */
async function sendCertificateEmailAsync(
  email: string,
  name: string,
  courseTitle: string,
  certificateNumber: string
) {
  try {
    const { sendCertificateNotification } = await import('@/lib/email');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const verificationUrl = `${baseUrl}/certificado/${certificateNumber}`;
    await sendCertificateNotification(email, name, courseTitle, certificateNumber, verificationUrl);
  } catch (error) {
    apiLogger.error({ email, certificateNumber, error }, 'Failed to send certificate email');
  }
}

/**
 * Envia push notification de certificado (async, nao bloqueia)
 */
async function sendPushToUserAsync(userId: string, courseTitle: string) {
  try {
    const { sendPushToUser } = await import('@/lib/push-notifications');
    await sendPushToUser(userId, {
      title: 'Certificado Emitido!',
      body: `Seu certificado de ${courseTitle} esta pronto!`,
      url: '/area-restrita/meus-certificados',
    });
  } catch (error) {
    apiLogger.error({ userId, courseTitle, error }, 'Failed to send certificate push');
  }
}
