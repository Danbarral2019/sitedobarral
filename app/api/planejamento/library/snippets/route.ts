import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { zCreateSnippetBody } from "@/data/planejamento/types";

export const GET = withAuth(async (request: NextRequest, context) => {
  const userId = (context!.user as { userId: string }).userId;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const snippets = await prisma.planningLibrarySnippet.findMany({
    where: {
      userId,
      ...(q && q.length >= 2
        ? {
            OR: [
              { titulo: { contains: q, mode: "insensitive" } },
              { corpoMd: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ snippets });
});

export const POST = withAuth(async (request: NextRequest, context) => {
  const userId = (context!.user as { userId: string }).userId;
  const body = await request.json().catch(() => ({}));
  const parsed = zCreateSnippetBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const snippet = await prisma.planningLibrarySnippet.create({
    data: {
      userId,
      titulo: parsed.data.titulo,
      corpoMd: parsed.data.corpoMd,
      tagsJson: parsed.data.tags ? JSON.stringify(parsed.data.tags) : null,
      sourceSectionId: parsed.data.sourceSectionId ?? null,
    },
  });
  return NextResponse.json({ snippet }, { status: 201 });
});
