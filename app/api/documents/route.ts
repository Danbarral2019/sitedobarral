import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { validateQueryParams } from '@/lib/validation-helper';
import { DocumentQuerySchema } from '@/lib/validation-schemas';

export async function GET(request: NextRequest) {
  try {
    // ✅ Obter e verificar token usando função centralizada
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // ✅ Usar verifyToken do lib/auth.ts (com validação Zod)
    const authPayload = await verifyToken(token);

    if (!authPayload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Buscar usuário com matrículas
    const user = await prisma.user.findUnique({
      where: { id: authPayload.userId },
      include: { enrollments: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // ✅ Validar query params com Zod
    const { searchParams } = new URL(request.url);
    const validation = validateQueryParams(searchParams, DocumentQuerySchema);

    if (validation.error) {
      return validation.error;
    }

    const { courseId } = validation.data;

    // Se for admin, pode ver todos os documentos
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
      return NextResponse.json(
        { error: 'Você não está matriculado neste curso ou seu acesso expirou' },
        { status: 403 }
      );
    }

    // Buscar documentos do curso (públicos + restritos já que está matriculado)
    const documents = await prisma.document.findMany({
      where: { courseId },
      orderBy: { uploadedAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Erro ao buscar documentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documentos' },
      { status: 500 }
    );
  }
}
