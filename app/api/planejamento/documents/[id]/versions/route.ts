import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { createVersion } from "@/lib/planejamento/versioning";
import { NotFoundError } from "@/lib/errors/api-error";

export const GET = withUserApi<{ id: string }>(async (_request: NextRequest, ctx) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    select: { id: true, currentVersionId: true },
  });
  if (!doc) {
    throw new NotFoundError("Documento");
  }

  const versions = await prisma.planningDocumentVersion.findMany({
    where: { documentId: id },
    orderBy: { versionNumber: "desc" },
    take: 50,
    select: {
      id: true,
      versionNumber: true,
      authorKind: true,
      authorId: true,
      label: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    versions,
    currentVersionId: doc.currentVersionId,
  });
});

export const POST = withUserApi<{ id: string }>(async (request: NextRequest, ctx) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;
  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.slice(0, 200) : undefined;

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    select: { id: true },
  });
  if (!doc) {
    throw new NotFoundError("Documento");
  }

  const { version, reused } = await createVersion({
    documentId: id,
    authorKind: "user",
    authorId: userId,
    label,
    skipIfIdentical: false, // manual sempre cria
  });

  return NextResponse.json({ version, reused }, { status: 201 });
});
