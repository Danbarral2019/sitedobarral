import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { checkAccessStatus } from '@/lib/enrollment-utils';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Obter token do cookie
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar e decodificar token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Buscar documento no banco
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Se o documento for público, permitir download sem verificações adicionais
    if (document.isPublic) {
      return await downloadFile(document);
    }

    // Para documentos restritos, verificar acesso do usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        enrollments: {
          where: { courseId: document.courseId }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Admins têm acesso a tudo
    if (user.role === 'admin') {
      return await downloadFile(document);
    }

    // Verificar se o usuário tem matrícula no curso do documento
    const enrollment = user.enrollments[0];
    if (!enrollment) {
      return NextResponse.json(
        { error: 'Você não está matriculado neste curso' },
        { status: 403 }
      );
    }

    // Verificar se o acesso ainda está válido
    const accessStatus = checkAccessStatus(enrollment);

    if (!accessStatus.hasAccess || accessStatus.isExpired) {
      return NextResponse.json(
        { error: 'Seu acesso a este curso expirou' },
        { status: 403 }
      );
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
      console.error('Erro ao registrar log:', logError);
    }

    // Permitir download
    return await downloadFile(document);

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar download' },
      { status: 500 }
    );
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
    console.error('Erro ao ler arquivo:', fileError);
    return NextResponse.json(
      { error: 'Arquivo não encontrado no servidor' },
      { status: 404 }
    );
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
