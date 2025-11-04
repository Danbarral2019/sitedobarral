import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { checkAccessStatus } from '@/lib/enrollment-utils';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ✅ Obter e verificar token usando função centralizada
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      throw new AuthenticationError();
    }

    // ✅ Verificar token (com validação Zod)
    const authPayload = await verifyToken(token);

    if (!authPayload) {
      throw new AuthenticationError('Token inválido ou expirado');
    }

    // Buscar documento no banco
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      apiLogger.warn({ documentId: id }, 'Document not found for download');
      throw new NotFoundError('Documento');
    }

    // Se o documento for público, permitir download sem verificações adicionais
    if (document.isPublic) {
      return await downloadFile(document);
    }

    // Para documentos restritos, verificar acesso do usuário
    const user = await prisma.user.findUnique({
      where: { id: authPayload.userId },
      include: {
        enrollments: {
          where: { courseId: document.courseId }
        }
      }
    });

    if (!user) {
      apiLogger.warn({ userId: authPayload.userId }, 'User not found for download');
      throw new NotFoundError('Usuário');
    }

    // Admins têm acesso a tudo
    if (user.role === 'admin') {
      return await downloadFile(document);
    }

    // Verificar se o usuário tem matrícula no curso do documento
    const enrollment = user.enrollments[0];
    if (!enrollment) {
      apiLogger.warn({ userId: user.id, courseId: document.courseId }, 'User not enrolled in course');
      throw new AuthorizationError('Você não está matriculado neste curso');
    }

    // Verificar se o acesso ainda está válido
    const accessStatus = checkAccessStatus(enrollment);

    if (!accessStatus.hasAccess || accessStatus.isExpired) {
      apiLogger.warn(
        { userId: user.id, courseId: document.courseId, expiresAt: enrollment.expiresAt },
        'User access expired'
      );
      throw new AuthorizationError('Seu acesso a este curso expirou');
    }

    // Registrar log de download
    try {
      await prisma.accessLog.create({
        data: {
          userId: user.id,
          courseId: document.courseId,
          action: 'download',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logError) {
      apiLogger.error({ err: logError, userId: user.id }, 'Failed to create download log');
    }

    apiLogger.info({ userId: user.id, documentId: document.id }, 'Document download successful');

    // Permitir download
    return await downloadFile(document);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Realiza o download do arquivo
 */
async function downloadFile(document: Record<string, unknown>): Promise<NextResponse> {
  // Se for link externo, redirecionar
  if (document.type === 'link' && document.url.startsWith('http')) {
    return NextResponse.redirect(document.url);
  }

  // Se for arquivo local, ler e retornar
  try {
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    const filePath = join(uploadsDir, document.url);

    // Ler arquivo
    const fileBuffer = await readFile(filePath);

    // Converte Buffer para Uint8Array (compatível com NextResponse)
    const uint8Array = new Uint8Array(fileBuffer);

    // Determinar tipo de conteúdo baseado na extensão
    const contentType = getContentType(document.url);

    // Retornar arquivo com headers apropriados
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(document.title || 'documento')}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (fileError) {
    apiLogger.error({ err: fileError, documentUrl: document.url }, 'Failed to read file');
    throw new NotFoundError('Arquivo no servidor');
  }
}

/**
 * Determina o tipo MIME baseado na extensão do arquivo
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}
