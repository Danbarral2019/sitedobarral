import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail, sendWelcomeEmail } from '@/lib/email';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { validateRequest } from '@/lib/validation-helper';
import { RegisterSchema } from '@/lib/validation-schemas';
import { handleApiError } from '@/lib/errors/error-handler';
import { ConflictError } from '@/lib/errors/api-error';
import { authLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';
import { reportError, reportMessage } from '@/lib/monitoring/report-error';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 cadastros por minuto por IP (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:register:${ip}`, 10, 60, { failureMode: 'closed' });

    // ✅ Validação com Zod
    const validation = await validateRequest(request, RegisterSchema);

    if (validation.error) {
      return validation.error;
    }

    const { name, password, qrCodeId } = validation.data;
    const email = validation.data.email.toLowerCase();

    // Verificar se o email já está cadastrado
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      authLogger.warn({ email }, 'Registration attempt: email already exists');
      throw new ConflictError('Este email já está cadastrado');
    }

    // Criar hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // QR code: a matrícula e o consumo da vaga ficam para a verificação do
    // email (app/api/auth/verify-email). Aqui só se guarda o QR pendente, se
    // ele existir e estiver no prazo; a vaga é conferida na verificação.
    let pendingQrCodeId: string | null = null;
    let qrCourseId: string | null = null;
    if (qrCodeId) {
      try {
        const qrCode = await prisma.qRCode.findUnique({
          where: { code: qrCodeId },
        });

        if (qrCode && new Date() < qrCode.validUntil) {
          pendingQrCodeId = qrCode.id;
          qrCourseId = qrCode.courseId;
        } else {
          authLogger.warn({ qrCodeId }, 'Registration with missing or expired QR Code');
        }
      } catch (qrError) {
        // Não falhar o registro por erro na leitura do QR code
        authLogger.error({ err: qrError, qrCodeId }, 'Failed to read QR Code on registration');
        reportError(qrError, 'auth', { etapa: 'leitura-qr' });
      }
    }

    // Gerar token de verificação (válido por 24h)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'student',
        emailVerified: false,
        verificationToken,
        verificationExpiry,
        pendingQrCodeId,
      },
    });

    // Enviar email de verificação
    const emailSent = await sendVerificationEmail(
      user.email,
      user.name,
      verificationToken
    );

    if (!emailSent) {
      authLogger.error({ userId: user.id, email: user.email }, 'Failed to send verification email');
      reportMessage('Failed to send verification email', 'auth', { userId: user.id });
    }

    // Enviar welcome email (fire-and-forget)
    sendWelcomeEmail(user.email, user.name).catch((err) => {
      authLogger.error({ err, userId: user.id }, 'Failed to send welcome email');
    });

    // Registrar log de acesso
    try {
      await prisma.accessLog.create({
        data: {
          userId: user.id,
          qrCode: qrCodeId || null,
          courseId: qrCourseId,
          action: 'register',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logError) {
      authLogger.error({ err: logError, userId: user.id }, 'Failed to create access log');
    }

    authLogger.info({ userId: user.id, email: user.email, pendingQrCodeId }, 'User registration successful');
    trackServerEvent('user_register', { courseId: qrCourseId || 'none' });

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
