import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { listSessions } from "@/lib/planejamento/session-manager";
import { FileText, Plus, Clock } from "lucide-react";
import PlanningOnboardingBanner from "@/components/planejamento/PlanningOnboardingBanner";

export const dynamic = "force-dynamic";

export default async function PlanejamentoListPage() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("auth-token")?.value ||
    cookieStore.get("auth_token")?.value;
  if (!token) redirect("/login?redirect=/area-restrita/planejamento");
  const decoded = await verifyToken(token);
  if (!decoded) redirect("/login?redirect=/area-restrita/planejamento");

  const sessions = await listSessions(decoded.userId);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-brand-900 mb-2">
            Planejamento da Contratação
          </h1>
          <p className="text-ink-muted max-w-2xl">
            Elabore ETP e Termo de Referência com assistência guiada, ancorada
            na base do curso. Cada contratação aqui é uma sessão sua, com
            versionamento próprio.
          </p>
        </div>
        <Link
          href="/area-restrita/planejamento/nova"
          className="inline-flex items-center gap-2 rounded-[6px] bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
        >
          <Plus className="h-4 w-4" />
          Nova contratação
        </Link>
      </header>

      <PlanningOnboardingBanner showByDefault={sessions.length === 0} />

      {sessions.length === 0 ? (
        <div className="rounded-[6px] border-2 border-dashed border-border-subtle p-12 text-center">
          <FileText className="mx-auto mb-4 h-10 w-10 text-ink-muted" />
          <h2 className="mb-2 text-lg font-medium text-ink-primary">
            Nenhuma contratação iniciada
          </h2>
          <p className="mb-6 text-ink-muted">
            Comece descrevendo, em linguagem natural, a contratação do seu
            órgão. O assistente sugere a trilha adequada e conduz a elaboração
            do ETP.
          </p>
          <Link
            href="/area-restrita/planejamento/nova"
            className="inline-flex items-center gap-2 rounded-[6px] bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" />
            Iniciar primeira contratação
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/area-restrita/planejamento/${s.id}`}
                className="block rounded-[6px] border border-border-subtle p-5 transition hover:border-brand-600 hover:"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-serif text-lg text-brand-900">
                    {s.titulo}
                  </h3>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                    {friendlyStatus(s.status)}
                  </span>
                </div>
                {s.natureza && (
                  <p className="mb-3 text-xs text-ink-muted">
                    {friendlyNatureza(s.natureza)}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {s.documents.length} doc
                    {s.documents.length === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(s.updatedAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function friendlyStatus(s: string) {
  switch (s) {
    case "ONBOARDING":
      return "Onboarding";
    case "TRAIL_ETP":
      return "ETP em andamento";
    case "MATRIX_RUN":
      return "Matriz de decisão";
    case "TRAIL_TR":
      return "TR em andamento";
    case "REVIEW":
      return "Revisão final";
    case "EXPORT":
      return "Pronto para exportar";
    case "ARCHIVED":
      return "Arquivado";
    default:
      return s;
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
