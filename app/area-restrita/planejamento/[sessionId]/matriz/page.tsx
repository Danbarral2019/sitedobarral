import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";
import MatrixWizard from "@/components/planejamento/MatrixWizard";
import MatrixResultCard from "@/components/planejamento/MatrixResultCard";
import type { DecisionRunResult } from "@/components/planejamento/matrix-types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function MatrizPage({ params }: PageProps) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const token =
    cookieStore.get("auth-token")?.value ||
    cookieStore.get("auth_token")?.value;
  if (!token)
    redirect(`/login?redirect=/area-restrita/planejamento/${sessionId}/matriz`);
  const decoded = await verifyToken(token);
  if (!decoded)
    redirect(`/login?redirect=/area-restrita/planejamento/${sessionId}/matriz`);

  const session = await prisma.planningSession.findFirst({
    where: { id: sessionId, userId: decoded.userId, deletedAt: null },
    include: {
      decisionRuns: {
        orderBy: { executedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!session) notFound();

  const lastRun = session.decisionRuns[0];
  const lastResult: DecisionRunResult | null = lastRun
    ? (() => {
        try {
          return JSON.parse(lastRun.resultJson) as DecisionRunResult;
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/area-restrita/planejamento/${sessionId}`}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à trilha
      </Link>
      <h1 className="mt-3 font-serif text-2xl text-brand-900">
        Matriz de modalidade e critério
      </h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-muted">
        A recomendação é gerada por regras determinísticas fundadas nos arts.
        28 a 36 da Lei 14.133/2021. Os inputs informados são registrados para
        auditoria e podem ser revistos a qualquer momento.
      </p>

      {lastResult && (
        <div className="mb-8">
          <p className="mb-2 text-xs text-ink-muted">
            Última execução em{" "}
            {new Date(lastRun.executedAt).toLocaleString("pt-BR")}
          </p>
          <MatrixResultCard result={lastResult} />
        </div>
      )}

      <div className="rounded-[6px] border border-border-subtle bg-white p-6">
        <MatrixWizard sessionId={sessionId} />
      </div>
    </main>
  );
}
