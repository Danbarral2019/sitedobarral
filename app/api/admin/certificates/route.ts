import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors/api-error';
import { issueCertificate } from '@/lib/certificate';
import { getCourseById } from '@/lib/courses';

/**
 * GET: Listar todos os certificados emitidos.
 * Suporta filtro por status: all (default) | active | revoked | manual
 */
export const GET = withAdminApi(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;
    if (search) {
      where.OR = [
        { studentName: { contains: search, mode: 'insensitive' } },
        { certificateNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status === 'active') where.revokedAt = null;
    if (status === 'revoked') where.revokedAt = { not: null };
    if (status === 'manual') where.issuedById = { not: null };

    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          certificateNumber: true,
          studentName: true,
          courseTitle: true,
          courseId: true,
          userId: true,
          estimatedHours: true,
          issuedAt: true,
          issuedById: true,
          issueReason: true,
          revokedAt: true,
          revokedById: true,
          revokeReason: true,
          viewCount: true,
          user: { select: { email: true } },
        },
      }),
      prisma.certificate.count({ where }),
    ]);

    return NextResponse.json({
      certificates,
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    });
});

/**
 * POST: Emite um certificado manualmente (skip elegibilidade).
 * Body: { userId: string, courseId: string, reason?: string }
 */
export const POST = withAdminApi(async (request: NextRequest, ctx) => {
  const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ValidationError('Body JSON inválido');

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : undefined;
    if (!userId) throw new ValidationError('userId obrigatório');
    if (!courseId) throw new ValidationError('courseId obrigatório');

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundError('Usuário');
    const course = getCourseById(courseId);
    if (!course) throw new NotFoundError('Curso');

    const result = await issueCertificate(userId, courseId, {
      issuedById: ctx.user.userId,
      reason,
    });

    if (result.alreadyExists) {
      throw new ConflictError('Aluno já tem certificado para este curso');
    }
    if (!result.certificate) {
      throw new ValidationError('Falha ao emitir certificado');
    }

    return NextResponse.json({ ok: true, certificate: result.certificate }, { status: 201 });
});
