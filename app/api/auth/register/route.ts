import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/email';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { validateRequest } from '@/lib/validation-helper';
import { RegisterSchema } from '@/lib/validation-schemas';
import { handleApiError } from '@/lib/errors/error-handler';
import { ConflictError } from '@/lib/errors/api-error';
import { authLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 cadastros por minuto por IP (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:register:${ip}`, 10, 60);

    // ✅ Validação com Zod
    const validation = await validateRequest(request, RegisterSchema);

    if (validation.error) {
      return validation.error;
    }

    const { email, name, password, qrCodeId } = validation.data;

    // Verificar se o email já está cadastrado
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      authLogger.warn({ email }, 'Registration attempt: email already exists');
      throw new ConflictError('Este email já está cadastrado');
    }

    // Criar hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Gerar token de verificação (válido por 24h)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: 'student',
        emailVerified: false,
        verificationToken,
        verificationExpiry,
      },
    });

    // Se vier de um QR Code, criar matrícula no curso
    if (courseId && qrCodeId) {
      try {
        // Verificar se o QR Code existe e é válido
        const qrCode = await prisma.qRCode.findUnique({
          where: { code: qrCodeId },
        });

        if (qrCode && new Date() < qrCode.validUntil) {
          // Verificar se usuário já tem matrícula neste curso com este QR Code
          const existingEnrollment = await prisma.enrollment.findFirst({
            where: {
              userId: user.id,
              courseId: courseId,
              qrCodeId: qrCode.id
            }
          });

          if (existingEnrollment) {
            authLogger.info({ userId: user.id, qrCodeId }, 'User already has enrollment with this QR Code');
            // Não criar duplicata, mas não falhar o registro
          } else {
            // Incremento atômico do usedCount com verificação de limite (previne race condition)
            const updated = await prisma.$executeRaw`
              UPDATE "QRCode"
              SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
              WHERE code = ${qrCodeId}
              AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
            `;

            if (updated === 0) {
              authLogger.warn({ qrCodeId, maxUses: qrCode.maxUses }, 'QR Code reached max uses limit');
              // Não criar enrollment mas não falhar o registro
            } else {
              // ✅ PRAZO INDIVIDUALIZADO: 1 mês de trial a partir da data de REGISTRO do aluno
              const expirationDate = new Date(); // Data ATUAL (momento do registro)
              expirationDate.setMonth(expirationDate.getMonth() + 1);

              // Criar enrollment
              await prisma.enrollment.create({
                data: {
                  userId: user.id,
                  courseId,
                  turma: qrCode.turma,
                  qrCodeId: qrCode.id,
                  expiresAt: expirationDate,
                },
              });

              authLogger.info(
                { userId: user.id, email: user.email, expiresAt: expirationDate },
                'Enrollment created successfully'
              );
            }
          }
        }
      } catch (enrollmentError) {
        authLogger.error({ err: enrollmentError, userId: user.id }, 'Failed to create enrollment');
        // Não falhar o registro se erro na matrícula
      }
    }

    // Enviar email de verificação
    const emailSent = await sendVerificationEmail(
      user.email,
      user.name,
      verificationToken
    );

    if (!emailSent) {
      authLogger.error({ userId: user.id, email: user.email }, 'Failed to send verification email');
    }

    // Registrar log de acesso
    try {
      await prisma.accessLog.create({
        data: {
          userId: user.id,
          qrCode: qrCodeId || null,
          courseId: courseId || null,
          action: 'register',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logError) {
      authLogger.error({ err: logError, userId: user.id }, 'Failed to create access log');
    }

    authLogger.info({ userId: user.id, email: user.email }, 'User registration successful');
    trackServerEvent('user_register', { courseId: courseId || 'none' });

    return NextResponse.json(
      {
        success: true,
        message: 'Cadastro realizado com sucesso! Verifique seu email para ativar sua conta.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
