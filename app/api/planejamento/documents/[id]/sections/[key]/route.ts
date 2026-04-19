import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { zUpdateSectionBody } from "@/data/planejamento/types";
import { createVersion } from "@/lib/planejamento/versioning";

interface Ctx {
  params: Promise<{ id: string; key: string }>;
  user: { userId: string };
}

export const PATCH = withAuth(async (request: NextRequest, context) => {
  const { id, key } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const body = await request.json().catch(() => ({}));
  const parsed = zUpdateSectionBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Verifica ownership: documento pertence a sessão do user
  const section = await prisma.planningDocumentSection.findFirst({
    where: {
      documentId: id,
      sectionKey: key,
      document: { session: { userId, deletedAt: null } },
    },
  });
  if (!section) {
    return NextResponse.json({ error: "Seção não encontrada" }, { status: 404 });
  }

  const nextStatus = parsed.data.status ?? (
    parsed.data.contentMd && parsed.data.contentMd.trim().length > 0
      ? section.status === "PENDING"
        ? "IN_PROGRESS"
        : section.status
      : section.status
  );

  const updated = await prisma.planningDocumentSection.update({
    where: { id: section.id },
    data: {
      contentMd: parsed.data.contentMd ?? section.contentMd,
      status: nextStatus,
      justificationSkipped:
        parsed.data.justificationSkipped ?? section.justificationSkipped,
      conceptualCheckPassed:
        parsed.data.conceptualCheckPassed ?? section.conceptualCheckPassed,
      conceptualCheckAnswerMd:
        parsed.data.conceptualCheckAnswerMd ??
        section.conceptualCheckAnswerMd,
      conceptualCheckAnsweredAt:
        parsed.data.conceptualCheckAnswerMd != null
          ? new Date()
          : section.conceptualCheckAnsweredAt,
      lastEditedAt: new Date(),
    },
  });

  // Auto-snapshot ao confirmar seção (pula se snapshot idêntico)
  if (
    parsed.data.status === "CONFIRMED" &&
    section.status !== "CONFIRMED"
  ) {
    try {
      await createVersion({
        documentId: id,
        authorKind: "system",
        authorId: userId,
        label: `auto: ${key} confirmada`,
        skipIfIdentical: true,
      });
    } catch (err) {
      console.error("[planejamento/section] falhou auto-snapshot", err);
    }
  }

  return NextResponse.json({ section: updated });
});
