import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { zUpdateSessionBody } from "@/data/planejamento/types";
import {
  getSessionForUser,
  softDeleteSession,
  hardDeleteSession,
} from "@/lib/planejamento/session-manager";
import { NotFoundError, ValidationError } from "@/lib/errors/api-error";
import type { ApiContext } from "@/lib/api/types";

export const GET = withUserApi<{ id: string }>(async (_request: NextRequest, ctx: ApiContext<{ id: string }>) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;
  const session = await getSessionForUser(id, userId);
  if (!session) {
    throw new NotFoundError("Sessão");
  }
  return NextResponse.json({ session });
});

export const PATCH = withUserApi<{ id: string }>(async (request: NextRequest, ctx: ApiContext<{ id: string }>) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;
  const body = await request.json().catch(() => ({}));
  const parsed = zUpdateSessionBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Dados inválidos", parsed.error.issues);
  }
  const owned = await prisma.planningSession.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!owned) {
    throw new NotFoundError("Sessão");
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

export const DELETE = withUserApi<{ id: string }>(async (request: NextRequest, ctx: ApiContext<{ id: string }>) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;
  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "1";
  if (hard) {
    const res = await hardDeleteSession(id, userId);
    if (res.count === 0) {
      throw new NotFoundError("Sessão");
    }
    return NextResponse.json({ deleted: "hard", count: res.count });
  }
  const res = await softDeleteSession(id, userId);
  if (res.count === 0) {
    throw new NotFoundError("Sessão");
  }
  return NextResponse.json({ deleted: "soft", count: res.count });
});
