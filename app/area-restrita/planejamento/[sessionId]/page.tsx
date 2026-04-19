import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getSessionForUser } from "@/lib/planejamento/session-manager";
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Scale } from "lucide-react";
import SessionWorkspace from "@/components/planejamento/SessionWorkspace";
import DocumentTabs from "@/components/planejamento/DocumentTabs";
import type { PlanningSectionSource } from "@/data/planejamento/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ doc?: string }>;
}

export default async function PlanejamentoSessaoPage({
  params,
  searchParams,
}: PageProps) {
  const { sessionId } = await params;
  const { doc } = await searchParams;
  const requestedType = doc === "TR" ? "TR" : "ETP";

  const cookieStore = await cookies();
  const token =
    cookieStore.get("auth-token")?.value ||
    cookieStore.get("auth_token")?.value;
  if (!token) redirect(`/login?redirect=/area-restrita/planejamento/${sessionId}`);
  const decoded = await verifyToken(token);
  if (!decoded) redirect(`/login?redirect=/area-restrita/planejamento/${sessionId}`);

  const session = await getSessionForUser(sessionId, decoded.userId);
  if (!session) notFound();

  const etp = session.documents.find((d) => d.type === "ETP");
  const tr = session.documents.find((d) => d.type === "TR");
  const active =
    requestedType === "TR" && tr ? tr : etp ?? session.documents[0] ?? null;

  // Resolve a trail do documento ativo
  let trail: TrailDefinition | null = null;
  if (active) {
    const slugMap: Record<string, string | undefined> = {
      ETP:
        session.natureza === "SERVICO_CONTINUADO"
          ? "servico-comum-continuado-etp"
          : undefined,
      TR:
        session.natureza === "SERVICO_CONTINUADO"
          ? "servico-comum-continuado-tr"
          : undefined,
    };
    const targetSlug = slugMap[active.type];
    // 1) tenta buscar template publicado pelo slug apropriado
    if (targetSlug) {
      const tpl = await prisma.planningTrailTemplate.findUnique({
        where: { slug: targetSlug },
      });
      if (tpl) {
        try {
          trail = JSON.parse(tpl.definitionJsonCache);
        } catch {
          /* ignore */
        }
      }
      // 2) fallback para o catálogo TS se o admin ainda não publicou a trilha
      if (!trail) trail = getTrailBySlug(targetSlug) ?? null;
    }
  }

  const etpRequiredRemaining = etp
    ? etp.sections.filter(
        (s) =>
          s.required &&
          s.status !== "CONFIRMED" &&
          s.status !== "SKIPPED_WITH_JUSTIFICATION",
      ).length
    : 0;
  const canTransitionTr =
    etp && !tr && etpRequiredRemaining === 0 && session.natureza === "SERVICO_CONTINUADO";

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3 px-4 py-4">
          <div>
            <Link
              href="/area-restrita/planejamento"
              className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-brand-700"
            >
              <ArrowLeft className="h-3 w-3" /> Minhas contratações
            </Link>
            <h1 className="mt-2 font-serif text-2xl text-brand-900">
              {session.titulo}
            </h1>
            {session.natureza && (
              <p className="text-xs text-gray-500">
                {friendlyNatureza(session.natureza)} · status:{" "}
                {friendlyStatus(session.status)}
              </p>
            )}
          </div>
          <Link
            href={`/area-restrita/planejamento/${session.id}/matriz`}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:border-brand-400"
          >
            <Scale className="h-4 w-4" /> Matriz de modalidade
          </Link>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3">
          <DocumentTabs
            sessionId={session.id}
            activeType={active?.type === "TR" ? "TR" : "ETP"}
            etpPresent={!!etp}
            trPresent={!!tr}
            canTransitionTr={!!canTransitionTr}
            etpRequiredRemaining={etpRequiredRemaining}
          />
        </div>
      </div>

      {!active || !trail ? (
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm text-amber-900">
              Esta sessão ainda não possui trilha materializada para o
              documento selecionado. Confirme o onboarding ou retorne ao ETP.
            </p>
          </div>
        </div>
      ) : (
        <SessionWorkspace
          sessionId={session.id}
          documentId={active.id}
          documentType={active.type as "ETP" | "TR"}
          learningMode={session.learningMode}
          trail={trail}
          sections={active.sections.map((s) => ({
            id: s.id,
            sectionKey: s.sectionKey,
            ordem: s.ordem,
            status: s.status,
            contentMd: s.contentMd ?? "",
            generationProvenance: s.generationProvenance ?? null,
            justificationSkipped: s.justificationSkipped ?? null,
            sources: parseSources(s.sourcesJson),
            sufficiencyScore: s.sufficiencyScore ?? null,
            conceptualCheckAnswerMd: s.conceptualCheckAnswerMd ?? null,
            conceptualCheckPassed: s.conceptualCheckPassed ?? null,
            derivedFromSectionId: s.derivedFromSectionId ?? null,
          }))}
        />
      )}
    </main>
  );
}

function parseSources(raw: string | null | undefined): PlanningSectionSource[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function friendlyStatus(s: string) {
  switch (s) {
    case "ONBOARDING":
      return "onboarding";
    case "TRAIL_ETP":
      return "ETP em andamento";
    case "TRAIL_TR":
      return "TR em andamento";
    case "REVIEW":
      return "revisão";
    case "EXPORT":
      return "exportação";
    case "ARCHIVED":
      return "arquivado";
    default:
      return s.toLowerCase();
  }
}

function friendlyNatureza(n: string) {
  const map: Record<string, string> = {
    BEM_COMUM: "Bem comum",
    BEM_ESPECIAL: "Bem especial",
    SERVICO_COMUM: "Serviço comum",
    SERVICO_CONTINUADO: "Serviço continuado",
    SERVICO_ESPECIAL: "Serviço especial",
    OBRA: "Obra",
    SERVICO_ENGENHARIA: "Serviço de engenharia",
  };
  return map[n] ?? n;
}
