import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors/api-error';

export const PATCH = withAdminApi<{ id: string }>(async (request: NextRequest, ctx) => {
  const { id } = ctx.params;
  const body = await request.json();
  const { area, tema, subtema, markReviewed } = body as {
    area?: string;
    tema?: string;
    subtema?: string | null;
    markReviewed?: boolean;
  };

  if (!area || !tema) {
    throw new ValidationError('area e tema sao obrigatorios');
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
