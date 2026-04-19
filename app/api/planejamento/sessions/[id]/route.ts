import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { zUpdateSessionBody } from "@/data/planejamento/types";
import {
  getSessionForUser,
  softDeleteSession,
  hardDeleteSession,
} from "@/lib/planejamento/session-manager";

interface Ctx {
  params: Promise<{ id: string }>;
  user: { userId: string };
}

export const GET = withAuth(async (_request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const session = await getSessionForUser(id, userId);
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ session });
});

export const PATCH = withAuth(async (request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const body = await request.json().catch(() => ({}));
  const parsed = zUpdateSessionBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const owned = await prisma.planningSession.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }
  const session = await prisma.planningSession.update({
    where: { id },
    data: {
      titulo: parsed.data.titulo,
      learningMode: parsed.data.learningMode,
      archivedAt:
        parsed.data.archivedAt === null
          ? null
          : parsed.data.archivedAt
            ? new Date(parsed.data.archivedAt)
            : undefined,
      status:
        parsed.data.archivedAt === null
          ? undefined
          : parsed.data.archivedAt
            ? "ARCHIVED"
            : undefined,
    },
  });
  return NextResponse.json({ session });
});

export const DELETE = withAuth(async (request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "1";
  if (hard) {
    const res = await hardDeleteSession(id, userId);
    if (res.count === 0) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ deleted: "hard", count: res.count });
  }
  const res = await softDeleteSession(id, userId);
  if (res.count === 0) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ deleted: "soft", count: res.count });
});
