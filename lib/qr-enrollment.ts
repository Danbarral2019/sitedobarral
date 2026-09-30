import { prisma } from '@/lib/prisma';
import { authLogger } from '@/lib/logger';

/**
 * Resultado da ativação da matrícula por QR code na verificação do email.
 * Só `enrolled` consumiu vaga.
 */
export type PendingQrEnrollmentResult =
  | { status: 'enrolled'; courseId: string; expiresAt: Date }
  | { status: 'already-enrolled'; courseId: string }
  | { status: 'qr-missing' }
  | { status: 'qr-expired'; courseId: string }
  | { status: 'qr-full'; courseId: string };

/**
 * Cria a matrícula de trial (1 mês) guardada no cadastro como QR pendente
 * (User.pendingQrCodeId) e consome a vaga do QR code.
 *
 * Roda na verificação do email, não no cadastro: conta nunca confirmada não
 * ocupa vaga da turma. O QR é revalidado agora (existe, está no prazo, tem
 * vaga); se falhar, a verificação segue e o motivo fica no log.
 *
 * O incremento de usedCount é condicional (usedCount < maxUses) e roda na
 * mesma transação da matrícula: vaga consumida sem matrícula não acontece, e
 * dois alunos disputando a última vaga não passam os dois.
 */
export async function activatePendingQrEnrollment(
  userId: string,
  pendingQrCodeId: string,
): Promise<PendingQrEnrollmentResult> {
  const qrCode = await prisma.qRCode.findUnique({ where: { id: pendingQrCodeId } });

  if (!qrCode) {
    authLogger.warn({ userId, qrCodeId: pendingQrCodeId }, 'Pending QR Code not found at email verification');
    return { status: 'qr-missing' };
  }

  const courseId = qrCode.courseId;

  if (new Date() >= qrCode.validUntil) {
    authLogger.warn(
      { userId, qrCodeId: qrCode.id, validUntil: qrCode.validUntil },
      'Pending QR Code expired before email verification; no enrollment created',
    );
    return { status: 'qr-expired', courseId };
  }

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId, qrCodeId: qrCode.id },
    select: { id: true },
  });
  if (existingEnrollment) {
    authLogger.info({ userId, qrCodeId: qrCode.id }, 'User already has enrollment with this QR Code');
    return { status: 'already-enrolled', courseId };
  }

  // Trial de 1 mês contado da verificação do email (início efetivo do acesso).
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const enrolled = await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE "QRCode"
      SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
      WHERE id = ${qrCode.id}
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    `;

    if (updated === 0) {
      return false;
    }

    await tx.enrollment.create({
      data: {
        userId,
        courseId,
        turma: qrCode.turma,
        qrCodeId: qrCode.id,
        expiresAt,
      },
    });
    return true;
  });

  if (!enrolled) {
    authLogger.warn(
      { userId, qrCodeId: qrCode.id, maxUses: qrCode.maxUses },
      'QR Code reached max uses before email verification; email verified without enrollment',
    );
    return { status: 'qr-full', courseId };
  }

  authLogger.info({ userId, courseId, qrCodeId: qrCode.id, expiresAt }, 'Enrollment created at email verification');
  return { status: 'enrolled', courseId, expiresAt };
}
