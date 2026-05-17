import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { zOnboardingBody } from "@/data/planejamento/types";
import { classifyNatureza } from "@/lib/planejamento/onboarding-classifier";
import {
  materializeDocumentFromTrail,
  resolveDefaultTrailSlug,
} from "@/lib/planejamento/session-manager";
import { ValidationError, NotFoundError } from "@/lib/errors/api-error";
import type { ApiContext } from "@/lib/api/types";

export const POST = withUserApi<{ id: string }>(async (request: NextRequest, ctx: ApiContext<{ id: string }>) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;
  const body = await request.json().catch(() => ({}));
  const parsed = zOnboardingBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Dados inválidos", parsed.error.issues);
  }

  const session = await prisma.planningSession.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!session) {
    throw new NotFoundError("Sessão");
  }

  const classification = classifyNatureza(parsed.data.descricaoLivre);

  await prisma.planningSession.update({
    where: { id },
    data: {
      descricaoLivre: parsed.data.descricaoLivre,
      natureza: classification.naturezaSugerida,
      classificacaoJson: JSON.stringify(classification),
    },
  });

  // Se já temos trilha default, materializa o ETP inicial
  const trailSlug = resolveDefaultTrailSlug(classification.naturezaSugerida, "ETP");
  let document = null;
  if (trailSlug) {
    try {
      document = await materializeDocumentFromTrail(id, trailSlug);
    } catch (err) {
      console.error("[planejamento/onboarding] falhou ao materializar ETP", err);
    }
  }

  return NextResponse.json({ classification, document });
});
