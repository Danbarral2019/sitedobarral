import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { sendContactNotification } from '@/lib/email';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, ValidationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

const optionalText = (max: number, label: string) =>
  z
    .string({ message: `${label} inválido` })
    .trim()
    .max(max, `${label} muito longo`)
    .nullish()
    .transform((v) => (v ? v : null));

// Formulário público: tipos e tamanhos limitados antes de gravar e de montar o e-mail
const contactSchema = z.object({
  name: z
    .string({ message: 'Nome, e-mail e mensagem são obrigatórios' })
    .trim()
    .min(1, 'Nome, e-mail e mensagem são obrigatórios')
    .max(120, 'Nome muito longo'),
  email: z
    .string({ message: 'Nome, e-mail e mensagem são obrigatórios' })
    .trim()
    .min(1, 'Nome, e-mail e mensagem são obrigatórios')
    .max(254, 'E-mail inválido')
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail inválido'),
  phone: optionalText(40, 'Telefone'),
  courseInterest: optionalText(200, 'Curso de interesse'),
  message: z
    .string({ message: 'Nome, e-mail e mensagem são obrigatórios' })
    .trim()
    .min(1, 'Nome, e-mail e mensagem são obrigatórios')
    .max(5000, 'Mensagem muito longa (máximo de 5.000 caracteres)'),
});

// POST - Enviar mensagem de contato
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 envios por minuto (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`form:contact:${ip}`, 10, 60);
    const body = await request.json().catch(() => null);
    const parsed = contactSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
    }
    const { name, email, phone, courseInterest, message } = parsed.data;

    // Salvar no banco de dados
    const contact = await prisma.contactForm.create({
      data: {
        name,
        email,
        phone: phone || null,
        courseInterest: courseInterest || null,
        message,
      },
    });

    // Se for um depoimento, criar registro de Testimonial para moderação
    if (courseInterest === 'depoimento') {
      const colors = [
        'from-blue-400 to-blue-600',
        'from-green-400 to-green-600',
        'from-purple-400 to-purple-600',
        'from-orange-400 to-orange-600',
        'from-pink-400 to-pink-600',
        'from-indigo-400 to-indigo-600',
        'from-red-400 to-red-600',
        'from-teal-400 to-teal-600',
      ];
      const avatar = name.charAt(0).toUpperCase();
      const color = colors[Math.floor(Math.random() * colors.length)];

      try {
        await prisma.testimonial.create({
          data: {
            name,
            email,
            phone: phone || null,
            role: 'Aluno', // Padrão - pode ser editado na moderação
            text: message,
            rating: 5, // Padrão
            avatar,
            color,
            status: 'pending',
            contactFormId: contact.id,
          },
        });
      } catch (error) {
        apiLogger.error({ err: error, contactId: contact.id }, 'Erro ao criar testimonial');
        // Não propaga o erro - o contato já foi salvo
      }
    }

    // Enviar notificação por email ao admin (não bloqueia a resposta)
    sendContactNotification(
      {
        name,
        email,
        phone: phone || null,
        courseInterest: courseInterest || null,
        message,
      },
      contact.id
    ).catch((error) => {
      apiLogger.error({ err: error, contactId: contact.id }, 'Erro ao enviar notificacao de contato');
      // Não propaga o erro - o contato já foi salvo com sucesso
    });

    trackServerEvent('contact_form');

    return NextResponse.json(
      {
        message: 'Mensagem enviada com sucesso!',
        contact: {
          id: contact.id,
          createdAt: contact.createdAt
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// GET - Listar contatos (admin apenas)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação e autorização admin
    const auth = await verifyAuth(request);
    if (!auth.valid || !auth.user) {
      throw new AuthenticationError();
    }
    if (auth.user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { searchParams } = new URL(request.url);
    const isRead = searchParams.get('isRead');
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const limit = Math.max(1, Math.min(100, isNaN(limitParam) ? 50 : limitParam));

    const where: Record<string, unknown> = {};
    if (isRead !== null && isRead !== 'all') {
      where.isRead = isRead === 'true';
    }

    const contacts = await prisma.contactForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const stats = {
      unread: await prisma.contactForm.count({ where: { isRead: false } }),
      read: await prisma.contactForm.count({ where: { isRead: true } }),
    };

    return NextResponse.json({ contacts, stats });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH - Marcar contato como lido/não lido (admin apenas)
export async function PATCH(request: NextRequest) {
  try {
    // Verificar autenticação e autorização admin
    const auth = await verifyAuth(request);
    if (!auth.valid || !auth.user) {
      throw new AuthenticationError();
    }
    if (auth.user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { id, isRead } = await request.json();

    if (!id) {
      throw new ValidationError('ID do contato é obrigatório');
    }

    const contact = await prisma.contactForm.update({
      where: { id },
      data: { isRead: isRead !== undefined ? isRead : true },
    });

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Deletar contato (admin apenas)
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticação e autorização admin
    const auth = await verifyAuth(request);
    if (!auth.valid || !auth.user) {
      throw new AuthenticationError();
    }
    if (auth.user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new ValidationError('ID do contato é obrigatório');
    }

    await prisma.contactForm.delete({
      where: { id },
    });

    apiLogger.info({ contactId: id, adminUserId: auth.user.userId }, 'Contact deleted');

    return NextResponse.json({
      success: true,
      message: 'Contato deletado com sucesso',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
