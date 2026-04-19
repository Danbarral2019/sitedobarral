import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { diffSnapshots, type DocumentSnapshot } from "@/lib/planejamento/versioning";

interface Ctx {
  params: Promise<{ id: string; n: string }>;
  user: { userId: string };
}

/**
 * GET /api/planejamento/documents/[id]/versions/[n]/diff
 * Retorna diff da versão N contra a imediatamente anterior (por versionNumber).
 */
export const GET = withAuth(async (_request: NextRequest, context) => {
  const { id, n } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const version = Number.parseInt(n, 10);
  if (!Number.isFinite(version) || version < 1) {
    return NextResponse.json({ error: "Versão inválida" }, { status: 400 });
  }

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    select: { id: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  const current = await prisma.planningDocumentVersion.findUnique({
    where: { documentId_versionNumber: { documentId: id, versionNumber: version } },
  });
  if (!current) {
    return NextResponse.json({ error: "Versão não encontrada" }, { status: 404 });
  }
  const previous = await prisma.planningDocumentVersion.findFirst({
    where: { documentId: id, versionNumber: { lt: version } },
    orderBy: { versionNumber: "desc" },
  });

  const toSnap = JSON.parse(current.snapshotJson) as DocumentSnapshot;
  if (!previous) {
    // Sem ancestral: diff representa "tudo adicionado"
    return NextResponse.json({
      diff: diffSnapshots(
        { ...toSnap, sections: [] },
        toSnap,
        { fromVersion: null, toVersion: version },
      ),
    });
  }
  const fromSnap = JSON.parse(previous.snapshotJson) as DocumentSnapshot;
  return NextResponse.json({
    diff: diffSnapshots(fromSnap, toSnap, {
      fromVersion: previous.versionNumber,
      toVersion: version,
    }),
  });
});
