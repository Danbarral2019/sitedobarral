import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { validateQueryParams } from '@/lib/validation-helper';
import { DocumentQuerySchema } from '@/lib/validation-schemas';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

export async function GET(request: NextRequest) {
  try {
    // ✅ Obter e verificar token usando função centralizada
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      throw new AuthenticationError();
    }

    // ✅ Usar verifyToken do lib/auth.ts (com validação Zod)
    const authPayload = await verifyToken(token);

    if (!authPayload) {
      throw new AuthenticationError('Token inválido ou expirado');
    }

    // Buscar usuário com matrículas
    const user = await prisma.user.findUnique({
      where: { id: authPayload.userId },
      include: { enrollments: true },
    });

    if (!user) {
      apiLogger.warn({ userId: authPayload.userId }, 'User not found in documents API');
      throw new NotFoundError('Usuário');
    }

    // ✅ Validar query params com Zod
    const { searchParams } = new URL(request.url);
    const validation = validateQueryParams(searchParams, DocumentQuerySchema);

    if (validation.error) {
      return validation.error;
    }

    const { courseId } = validation.data;

    // Se for admin, pode ver todos os documentos (sem cache para admin)
    if (user.role === 'admin') {
      const documents = await prisma.document.findMany({
        where: { courseId },
        orderBy: { uploadedAt: 'desc' },
      });

      return NextResponse.json({ documents });
    }

    // Para alunos, verificar se está matriculado E se o acesso não expirou
    const now = new Date();
    const isEnrolled = user.enrollments.some(e =>
      e.courseId === courseId &&
      (e.isLifetime || (e.expiresAt && e.expiresAt > now))
    );

    if (!isEnrolled) {
      apiLogger.warn(
        { userId: user.id, courseId },
        'Access denied: user not enrolled or enrollment expired'
      );
      throw new AuthorizationError('Você não está matriculado neste curso ou seu acesso expirou');
    }

    // Generate cache key for this user + course combination
    const cacheKey = CacheKeys.courseDocuments(courseId, user.id);

    // Use cached result or fetch from database
    const result = await withCache(
      cacheKey,
      async () => {
        // Buscar documentos do curso (públicos + restritos já que está matriculado)
        const documents = await prisma.document.findMany({
          where: { courseId },
          orderBy: { uploadedAt: 'desc' },
        });

        apiLogger.info({ userId: user.id, courseId, count: documents.length }, 'Documents fetched successfully');

        return { documents };
      },
      CACHE_TTL.COURSE_DOCUMENTS,
      { prefix: 'docs' }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
