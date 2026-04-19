import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { zOnboardingBody } from "@/data/planejamento/types";
import { classifyNatureza } from "@/lib/planejamento/onboarding-classifier";
import {
  materializeDocumentFromTrail,
  resolveDefaultTrailSlug,
} from "@/lib/planejamento/session-manager";

interface Ctx {
  params: Promise<{ id: string }>;
  user: { userId: string };
}

export const POST = withAuth(async (request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const body = await request.json().catch(() => ({}));
  const parsed = zOnboardingBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const session = await prisma.planningSession.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
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
