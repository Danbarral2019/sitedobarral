import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = withAdminAuth(async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const body = await request.json();
  const { area, tema, subtema, markReviewed } = body as {
    area?: string;
    tema?: string;
    subtema?: string | null;
    markReviewed?: boolean;
  };

  if (!area || !tema) {
    return NextResponse.json({ error: 'area e tema sao obrigatorios' }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    tcuArea: area,
    tcuTema: tema,
    tcuSubtema: subtema ?? null,
  };
  if (markReviewed) {
    data.tcuRevisadoPorAdmin = true;
  }

  await prisma.$transaction([
    prisma.document.update({ where: { id }, data }),
    prisma.documentMetaTcu.upsert({
      where: { documentId: id },
      create: {
        documentId: id,
        area,
        tema,
        subtema: subtema ?? null,
        revisadoPorAdmin: !!markReviewed,
      },
      update: {
        area,
        tema,
        subtema: subtema ?? null,
        ...(markReviewed ? { revisadoPorAdmin: true } : {}),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
});
