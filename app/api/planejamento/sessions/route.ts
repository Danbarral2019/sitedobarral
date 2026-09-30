import { NextRequest, NextResponse } from "next/server";
import { withAssinanteApi } from "@/lib/api/handler";
import {
  createSession,
  listSessions,
} from "@/lib/planejamento/session-manager";
import { zCreateSessionBody } from "@/data/planejamento/types";

export const GET = withAssinanteApi(async (_request: NextRequest, ctx) => {
  const userId = ctx.user.userId;
  const sessions = await listSessions(userId);
  return NextResponse.json({ sessions });
});

export const POST = withAssinanteApi(async (request: NextRequest, ctx) => {
  const userId = ctx.user.userId;
  const body = await request.json().catch(() => ({}));
  const parsed = zCreateSessionBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const session = await createSession({ userId, titulo: parsed.data.titulo });
  return NextResponse.json({ session }, { status: 201 });
});
