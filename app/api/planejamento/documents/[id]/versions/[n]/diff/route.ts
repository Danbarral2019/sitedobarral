import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { diffSnapshots, type DocumentSnapshot } from "@/lib/planejamento/versioning";
import { ValidationError, NotFoundError } from "@/lib/errors/api-error";

/**
 * GET /api/planejamento/documents/[id]/versions/[n]/diff
 * Retorna diff da versão N contra a imediatamente anterior (por versionNumber).
 */
export const GET = withUserApi<{ id: string; n: string }>(async (_request: NextRequest, ctx) => {
  const { id, n } = ctx.params;
  const userId = ctx.user.userId;
  const version = Number.parseInt(n, 10);
  if (!Number.isFinite(version) || version < 1) {
    throw new ValidationError("Versão inválida");
  }

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    select: { id: true },
  });
  if (!doc) {
    throw new NotFoundError("Documento");
  }

  const current = await prisma.planningDocumentVersion.findUnique({
    where: { documentId_versionNumber: { documentId: id, versionNumber: version } },
  });
  if (!current) {
    throw new NotFoundError("Versão");
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
