import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { DECISION_MATRICES } from "@/data/planejamento/decision-matrix/modalidade-julgamento-v1";

/**
 * GET /api/planejamento/decision/matrices
 * Lista (sem as regras) as matrizes disponíveis — usado pela UI do wizard
 * para carregar inputs.
 */
export const GET = withAuth(async () => {
  return NextResponse.json({
    matrices: DECISION_MATRICES.map((m) => ({
      slug: m.slug,
      version: m.version,
      title: m.title,
      inputs: m.inputs,
    })),
  });
});
