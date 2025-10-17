import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password, courseId, qrCodeId } = body;

    // Validações básicas
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Email, nome e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Validar senha (mínimo 6 caracteres)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

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
          // Calcular data de expiração: 1 ano após criação do QR Code da turma
          const expirationDate = new Date(qrCode.createdAt);
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);

          // Criar enrollment
          await prisma.enrollment.create({
            data: {
              userId: user.id,
              courseId,
              turma: qrCode.turma,
              qrCodeId: qrCode.id, // Usar o ID do QR Code, não o código em si
              expiresAt: expirationDate,
            },
          });

          // Incrementar contador de uso do QR Code
          await prisma.qRCode.update({
            where: { code: qrCodeId },
            data: { usedCount: { increment: 1 } },
          });
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
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar cadastro' },
      { status: 500 }
    );
  }
}
