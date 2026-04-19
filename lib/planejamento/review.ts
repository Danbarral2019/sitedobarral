/**
 * Revisão final — checklist de conformidade + coherence check.
 *
 * Ambos são heurísticos, não-bloqueantes no MVP: produzem `findings` com
 * severidade (`info`, `warn`, `error`) para a UI destacar. Não há gatekeeping
 * automático sobre exportação — o juízo final é do aluno.
 */
import { prisma } from "@/lib/prisma";
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";

export type ReviewSeverity = "info" | "warn" | "error";

export interface ReviewFinding {
  id: string;
  sectionKey?: string;
  documentType?: "ETP" | "TR";
  severity: ReviewSeverity;
  kind: string;
  title: string;
  detail: string;
}

export interface ReviewReport {
  sessionId: string;
  etpPresent: boolean;
  trPresent: boolean;
  etpConfirmed: number;
  etpRequired: number;
  trConfirmed: number;
  trRequired: number;
  matrixRun: boolean;
  findings: ReviewFinding[];
  generatedAt: string;
}

export async function runReview(sessionId: string): Promise<ReviewReport> {
  const session = await prisma.planningSession.findUnique({
    where: { id: sessionId },
    include: {
      documents: {
        include: {
          sections: { orderBy: { ordem: "asc" } },
        },
      },
      decisionRuns: { orderBy: { executedAt: "desc" }, take: 1 },
    },
  });
  if (!session) throw new Error("Sessão não encontrada");

  const etp = session.documents.find((d) => d.type === "ETP");
  const tr = session.documents.find((d) => d.type === "TR");
  const findings: ReviewFinding[] = [];

  const etpTrail = resolveTrailForDoc(session, etp, "ETP");
  const trTrail = resolveTrailForDoc(session, tr, "TR");

  // ---------- Checklist ETP ----------
  if (!etp) {
    findings.push({
      id: "etp-missing",
      severity: "error",
      kind: "checklist",
      title: "ETP não materializado",
      detail: "Não há documento de ETP associado à sessão.",
    });
  } else if (etpTrail) {
    evaluateChecklist(findings, etpTrail, etp, "ETP");
  }

  // ---------- Checklist TR ----------
  if (!tr) {
    findings.push({
      id: "tr-missing",
      severity: "warn",
      kind: "checklist",
      title: "TR ainda não iniciado",
      detail:
        "A sessão só é elegível para exportação quando o TR estiver completo. Use o botão 'Avançar para o TR' após confirmar todas as seções obrigatórias do ETP.",
    });
  } else if (trTrail) {
    evaluateChecklist(findings, trTrail, tr, "TR");
  }

  // ---------- Matriz ----------
  if (session.decisionRuns.length === 0) {
    findings.push({
      id: "matrix-not-run",
      severity: "warn",
      kind: "matrix",
      title: "Matriz de modalidade não executada",
      detail:
        "A seção 'Forma e critérios de seleção do fornecedor' do TR deve refletir a recomendação da matriz. Execute o wizard em 'Matriz de modalidade'.",
    });
  }

  // ---------- Coherence check ----------
  if (etp && tr && etpTrail && trTrail) {
    coherenceCheck(findings, etp, tr, trTrail);
  }

  const etpRequired = etpTrail
    ? etpTrail.sections.filter((s) => s.required).length
    : 0;
  const etpConfirmed = etp
    ? etp.sections.filter((s) => s.status === "CONFIRMED" || s.status === "SKIPPED_WITH_JUSTIFICATION").length
    : 0;
  const trRequired = trTrail
    ? trTrail.sections.filter((s) => s.required).length
    : 0;
  const trConfirmed = tr
    ? tr.sections.filter((s) => s.status === "CONFIRMED" || s.status === "SKIPPED_WITH_JUSTIFICATION").length
    : 0;

  return {
    sessionId,
    etpPresent: !!etp,
    trPresent: !!tr,
    etpConfirmed,
    etpRequired,
    trConfirmed,
    trRequired,
    matrixRun: session.decisionRuns.length > 0,
    findings,
    generatedAt: new Date().toISOString(),
  };
}

// ---------- Helpers ----------

function resolveTrailForDoc(
  session: { natureza: string | null },
  doc: { type: string } | undefined,
  type: "ETP" | "TR",
): TrailDefinition | null {
  if (!doc) return null;
  if (session.natureza === "SERVICO_CONTINUADO") {
    return (
      getTrailBySlug(
        type === "ETP"
          ? "servico-comum-continuado-etp"
          : "servico-comum-continuado-tr",
      ) ?? null
    );
  }
  return null;
}

function evaluateChecklist(
  findings: ReviewFinding[],
  trail: TrailDefinition,
  doc: { sections: Array<{ sectionKey: string; status: string; contentMd: string | null; generationProvenance: string | null; conceptualCheckPassed: boolean | null; required: boolean }> },
  kind: "ETP" | "TR",
) {
  const byKey = Object.fromEntries(doc.sections.map((s) => [s.sectionKey, s]));
  for (const def of trail.sections) {
    const st = byKey[def.key];
    if (!st) {
      findings.push({
        id: `${kind}-missing-${def.key}`,
        sectionKey: def.key,
        documentType: kind,
        severity: def.required ? "error" : "warn",
        kind: "checklist",
        title: `Seção ausente no documento: ${def.title}`,
        detail: `A trilha declara a seção ${def.key}, mas não existe registro correspondente no ${kind}.`,
      });
      continue;
    }
    if (
      st.status !== "CONFIRMED" &&
      st.status !== "SKIPPED_WITH_JUSTIFICATION"
    ) {
      findings.push({
        id: `${kind}-unconfirmed-${def.key}`,
        sectionKey: def.key,
        documentType: kind,
        severity: def.required ? "error" : "warn",
        kind: "checklist",
        title: `Seção não confirmada: ${def.title}`,
        detail: `Status atual: ${st.status}. Exportação do ${kind} exige que todas as seções obrigatórias estejam confirmadas ou dispensadas com justificativa.`,
      });
    }
    if (
      (st.contentMd ?? "").trim().length < 20 &&
      st.status === "CONFIRMED"
    ) {
      findings.push({
        id: `${kind}-empty-${def.key}`,
        sectionKey: def.key,
        documentType: kind,
        severity: "warn",
        kind: "checklist",
        title: `Seção confirmada com conteúdo insuficiente: ${def.title}`,
        detail:
          "A seção foi marcada como confirmada, mas o conteúdo é muito curto. Revise antes de exportar.",
      });
    }
    if (st.generationProvenance === "NOT_ANCHORED") {
      findings.push({
        id: `${kind}-not-anchored-${def.key}`,
        sectionKey: def.key,
        documentType: kind,
        severity: "warn",
        kind: "provenance",
        title: `Seção gerada sem ancoragem: ${def.title}`,
        detail:
          "O texto foi gerado sem fontes relevantes recuperadas da base do curso. Verifique cada afirmação manualmente.",
      });
    }
  }
}

/**
 * Coherence check entre seções pareadas ETP ↔ TR.
 * Compara comprimento e tokens-chave para detectar divergências grosseiras.
 * Não bloqueia — sinaliza para revisão humana.
 */
function coherenceCheck(
  findings: ReviewFinding[],
  etp: { sections: Array<{ sectionKey: string; contentMd: string | null; id: string }> },
  tr: {
    sections: Array<{
      sectionKey: string;
      contentMd: string | null;
      derivedFromSectionId: string | null;
    }>;
  },
  trTrail: TrailDefinition,
) {
  const etpById = Object.fromEntries(etp.sections.map((s) => [s.id, s]));
  const trByKey = Object.fromEntries(tr.sections.map((s) => [s.sectionKey, s]));

  for (const def of trTrail.sections) {
    const fromKey = def.promptSpec.derivesFromSectionKey;
    if (!fromKey) continue;
    const trSection = trByKey[def.key];
    if (!trSection) continue;

    const etpSection = trSection.derivedFromSectionId
      ? etpById[trSection.derivedFromSectionId]
      : etp.sections.find((s) => s.sectionKey === fromKey);

    if (!etpSection) {
      findings.push({
        id: `coherence-missing-${def.key}`,
        sectionKey: def.key,
        documentType: "TR",
        severity: "warn",
        kind: "coherence",
        title: `Sem fonte ETP para ${def.title}`,
        detail: `Esta seção do TR deriva de "${fromKey}" no ETP, mas o ETP correspondente não foi localizado.`,
      });
      continue;
    }

    const etpText = (etpSection.contentMd ?? "").trim();
    const trText = (trSection.contentMd ?? "").trim();
    if (etpText.length === 0 && trText.length === 0) continue;

    const ratio = etpText.length > 0 ? trText.length / etpText.length : 0;
    if (ratio < 0.3 && trText.length > 0) {
      findings.push({
        id: `coherence-shrunk-${def.key}`,
        sectionKey: def.key,
        documentType: "TR",
        severity: "warn",
        kind: "coherence",
        title: `TR muito mais curto que o ETP em ${def.title}`,
        detail: `O TR tem ${trText.length} caracteres contra ${etpText.length} no ETP (razão ${ratio.toFixed(2)}). Confirme se a síntese não omitiu elementos relevantes.`,
      });
    }

    // Detecção grosseira de divergência: números com ≥3 dígitos presentes num
    // lado e ausentes no outro. Heurística simples, porém útil para capturar
    // quantidades e valores divergentes.
    const etpNumbers = new Set(etpText.match(/\d{3,}/g) ?? []);
    const trNumbers = new Set(trText.match(/\d{3,}/g) ?? []);
    const onlyInEtp = [...etpNumbers].filter((n) => !trNumbers.has(n));
    const onlyInTr = [...trNumbers].filter((n) => !etpNumbers.has(n));
    if ((onlyInEtp.length > 0 || onlyInTr.length > 0) && etpNumbers.size + trNumbers.size > 0) {
      findings.push({
        id: `coherence-numbers-${def.key}`,
        sectionKey: def.key,
        documentType: "TR",
        severity: "warn",
        kind: "coherence",
        title: `Divergência numérica entre ETP e TR em ${def.title}`,
        detail: `Números presentes apenas no ETP: ${onlyInEtp.slice(0, 6).join(", ") || "—"}. Presentes apenas no TR: ${onlyInTr.slice(0, 6).join(", ") || "—"}.`,
      });
    }
  }
}
