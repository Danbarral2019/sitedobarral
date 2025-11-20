import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');

    if (!token) {
      throw new AuthenticationError();
    }

    const user = await verifyToken(token.value);
    if (!user) {
      throw new AuthenticationError();
    }

    // Verificar se é admin
    if (user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const body = await request.json();
    const { documentIds, action, courseId, isCommon } = body;

    // Validações
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      throw new ValidationError('documentIds deve ser um array não vazio');
    }

    if (!action || !['set-common', 'set-course', 'set-multiple-courses'].includes(action)) {
      throw new ValidationError('action deve ser set-common, set-course ou set-multiple-courses');
    }

    if (action === 'set-course' && !courseId) {
      throw new ValidationError('courseId é obrigatório quando action é set-course');
    }

    apiLogger.info({
      userId: user.id,
      action,
      documentCount: documentIds.length,
      courseId,
      isCommon
    }, 'Reclassificando documentos');

    let updateData: any = {};
    let updateMessage = '';

    switch (action) {
      case 'set-common':
        updateData = {
          isCommon: true,
          courseId: null
        };
        updateMessage = `${documentIds.length} documento(s) marcado(s) como comum (disponível em todos os cursos)`;
        break;

      case 'set-course':
        updateData = {
          isCommon: false,
          courseId: courseId
        };
        updateMessage = `${documentIds.length} documento(s) atribuído(s) ao curso ${courseId}`;
        break;

      case 'set-multiple-courses':
        // Para múltiplos cursos, vamos duplicar os documentos
        // Isso requer uma lógica diferente
        throw new ValidationError('Ação set-multiple-courses ainda não implementada');

      default:
        throw new ValidationError('Ação inválida');
    }

    // Verificar se todos os documentos existem
    const existingDocs = await prisma.document.findMany({
      where: {
        id: {
          in: documentIds
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    if (existingDocs.length !== documentIds.length) {
      const missingIds = documentIds.filter(id => !existingDocs.some(doc => doc.id === id));
      throw new NotFoundError(`Documento(s) não encontrado(s): ${missingIds.join(', ')}`);
    }

    // Atualizar os documentos
    const result = await prisma.document.updateMany({
      where: {
        id: {
          in: documentIds
        }
      },
      data: updateData
    });

    apiLogger.info({
      userId: user.id,
      updatedCount: result.count,
      action,
      courseId,
      isCommon
    }, 'Documentos reclassificados com sucesso');

    return NextResponse.json({
      success: true,
      message: updateMessage,
      updatedCount: result.count
    });

  } catch (error) {
    return handleApiError(error);
  }
}

// GET - Listar documentos com filtros para reclassificação
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');

    if (!token) {
      throw new AuthenticationError();
    }

    const user = await verifyToken(token.value);
    if (!user) {
      throw new AuthenticationError();
    }

    // Verificar se é admin
    if (user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const courseId = searchParams.get('courseId');
    const isCommon = searchParams.get('isCommon');
    const search = searchParams.get('search');

    // Construir filtros
    const where: any = {};

    if (category && category !== 'all') {
      where.category = category;
    }

    if (courseId && courseId !== 'all') {
      where.courseId = courseId;
    }

    if (isCommon === 'true') {
      where.isCommon = true;
    } else if (isCommon === 'false') {
      where.isCommon = false;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    apiLogger.info({
      userId: user.id,
      filters: { category, courseId, isCommon, search }
    }, 'Listando documentos para reclassificação');

    // Buscar documentos
    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        courseId: true,
        isCommon: true,
        onNumber: true,
        onYear: true,
        uploadedAt: true,
        updatedAt: true
      },
      orderBy: [
        { category: 'asc' },
        { onNumber: 'asc' },
        { title: 'asc' }
      ],
      take: 500 // Limite para performance
    });

    // Contar total
    const total = await prisma.document.count({ where });

    apiLogger.info({
      userId: user.id,
      count: documents.length,
      total
    }, 'Documentos listados para reclassificação');

    return NextResponse.json({
      documents,
      total,
      showing: documents.length
    });

  } catch (error) {
    return handleApiError(error);
  }
}
