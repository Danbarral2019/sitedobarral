import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { createVersion } from "@/lib/planejamento/versioning";

interface Ctx {
  params: Promise<{ id: string }>;
  user: { userId: string };
}

export const GET = withAuth(async (_request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    select: { id: true, currentVersionId: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
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

export const POST = withAuth(async (request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.slice(0, 200) : undefined;

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    select: { id: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
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
