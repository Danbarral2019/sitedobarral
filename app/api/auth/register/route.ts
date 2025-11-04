import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/email';
import { rateLimiters } from '@/lib/rate-limit';
import { validateRequest } from '@/lib/validation-helper';
import { RegisterSchema } from '@/lib/validation-schemas';

export async function POST(request: NextRequest) {
  // Rate limiting: 10 cadastros por minuto por IP
  try {
    await rateLimiters.forms.check(request, 10);
  } catch {
    return NextResponse.json(
      { error: 'Muitas tentativas de cadastro. Por favor, aguarde alguns instantes.' },
      { status: 429 }
    );
  }

  try {
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
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      );
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
            console.log('Usuário já possui matrícula com este QR Code');
            // Não criar duplicata, mas não falhar o registro
          } else {
            // Verificar se ainda há vagas disponíveis
            if (qrCode.maxUses && qrCode.usedCount >= qrCode.maxUses) {
              console.error('QR Code atingiu limite de usos');
              // Não criar enrollment mas não falhar o registro
            } else {
              // ✅ PRAZO INDIVIDUALIZADO: 1 ano a partir da data de REGISTRO do aluno
              const expirationDate = new Date(); // Data ATUAL (momento do registro)
              expirationDate.setFullYear(expirationDate.getFullYear() + 1);

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

              // Incrementar contador de uso do QR Code
              await prisma.qRCode.update({
                where: { code: qrCodeId },
                data: { usedCount: { increment: 1 } },
              });

              console.log(`Enrollment criado para ${user.email}. Expira em: ${expirationDate.toISOString()}`);
            }
          }
        }
      } catch (enrollmentError) {
        console.error('Erro ao criar enrollment:', enrollmentError);
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
      console.error('Falha ao enviar email de verificação');
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
      console.error('Erro ao registrar log:', logError);
    }

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
  } catch {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar cadastro' },
      { status: 500 }
    );
  }
}
