import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

interface Ctx {
  params: Promise<{ id: string }>;
  user: { userId: string };
}

export const DELETE = withAuth(async (_request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const res = await prisma.planningLibrarySnippet.deleteMany({
    where: { id, userId },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Snippet não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
});
