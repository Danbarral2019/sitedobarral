import { NextRequest, NextResponse } from "next/server";
import { withAssinanteApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors/api-error";

export const DELETE = withAssinanteApi<{ id: string }>(async (_request: NextRequest, ctx) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;
  const res = await prisma.planningLibrarySnippet.deleteMany({
    where: { id, userId },
  });
  if (res.count === 0) {
    throw new NotFoundError("Snippet");
  }
  return NextResponse.json({ deleted: true });
});
