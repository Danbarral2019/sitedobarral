import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { zUpdateSectionBody } from "@/data/planejamento/types";
import { createVersion } from "@/lib/planejamento/versioning";
import { ValidationError, NotFoundError } from "@/lib/errors/api-error";
import type { ApiContext } from "@/lib/api/types";

export const PATCH = withUserApi<{ id: string; key: string }>(async (request: NextRequest, ctx: ApiContext<{ id: string; key: string }>) => {
  const { id, key } = ctx.params;
  const userId = ctx.user.userId;
  const body = await request.json().catch(() => ({}));
  const parsed = zUpdateSectionBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Dados inválidos", parsed.error.issues);
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
    throw new NotFoundError("Seção");
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
