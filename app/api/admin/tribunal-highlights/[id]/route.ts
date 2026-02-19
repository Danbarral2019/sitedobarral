import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';

/**
 * GET /api/admin/tribunal-highlights/[id]
 * Busca highlight individual com dados da decisão
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.response;

  const { id } = await params;

  const highlight = await prisma.tribunalHighlight.findUnique({
    where: { id },
    include: {
      tribunalDecision: {
        select: {
          id: true,
          title: true,
          ementa: true,
          url: true,
          tribunalCode: true,
          tribunalName: true,
          decisionNumber: true,
          year: true,
          relator: true,
          orgaoJulgador: true,
          dataJulgamento: true,
          leiArticles: true,
          themes: true,
        },
      },
    },
  });

  if (!highlight) {
    return NextResponse.json({ error: 'Destaque não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ highlight });
}

/**
 * PATCH /api/admin/tribunal-highlights/[id]
 * Atualiza status e notas de um destaque TCE
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.response;

  const { id } = await params;

  const body = await request.json();
  const { status, adminNotes, blogPostId } = body;

  // Validar status
  const validStatuses = ['pending', 'dismissed', 'will_write', 'written'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Status inválido. Valores aceitos: ${validStatuses.join(', ')}` },
      { status: 400 }
    );
  }

  // Verificar se existe
  const existing = await prisma.tribunalHighlight.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Destaque não encontrado' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
  if (blogPostId !== undefined) updateData.blogPostId = blogPostId;

  const updated = await prisma.tribunalHighlight.update({
    where: { id },
    data: updateData,
    include: {
      tribunalDecision: {
        select: {
          id: true,
          title: true,
          url: true,
          tribunalCode: true,
        },
      },
    },
  });

  return NextResponse.json({ highlight: updated });
}
