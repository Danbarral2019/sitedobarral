/**
 * Renderer JSON com os metadados que o aluno vai usar para preencher os
 * formulários do PNCP e do Comprasnet. O escopo é deliberadamente
 * conservador — produz um artefato que pode ser copiado/colado ou
 * consumido por integrações futuras.
 */
import type { ASTDocument } from "../ast";

export interface PncpMetadata {
  /** schema e versão internos — facilitam migrações futuras */
  schema: "barral-planejamento-pncp/v1";
  documento: {
    tipo: "ETP" | "TR";
    titulo: string;
    sessionId: string;
    naturezaContratacao?: string;
    geradoEm: string;
  };
  objeto: {
    descricao: string;
  };
  modalidade?: {
    modalidade: string;
    criterio: string;
    justificativa: string;
    citacoes: string[];
    matrizSlug: string;
    matrizVersao: number;
    executadaEm?: string;
  };
  secoes: Array<{
    ordem: number;
    titulo: string;
    conteudo: string;
    fundamentos: string[];
    dispensada: boolean;
    justificativaDispensa?: string;
  }>;
}

export function renderPncpMetadata(doc: ASTDocument): Buffer {
  const objetoSec =
    doc.sections.find((s) => /objeto/i.test(s.title)) ?? doc.sections[0];
  const objetoTxt = objetoSec
    ? objetoSec.blocks
        .filter((b) => b.type === "paragraph")
        .map((b) => (b.type === "paragraph" ? b.text : ""))
        .join("\n\n")
    : "";

  const payload: PncpMetadata = {
    schema: "barral-planejamento-pncp/v1",
    documento: {
      tipo: doc.kind,
      titulo: doc.title,
      sessionId: doc.metadata.sessionId ?? "",
      naturezaContratacao: doc.metadata.natureza,
      geradoEm: new Date().toISOString(),
    },
    objeto: { descricao: objetoTxt.trim() },
    modalidade: doc.decision
      ? {
          modalidade: doc.decision.modalidade,
          criterio: doc.decision.criterio,
          justificativa: doc.decision.rationale,
          citacoes: doc.decision.citations,
          matrizSlug: doc.decision.matrixSlug,
          matrizVersao: doc.decision.matrixVersion,
          executadaEm: doc.decision.executedAt,
        }
      : undefined,
    secoes: doc.sections.map((s) => ({
      ordem: s.ordem,
      titulo: s.title,
      fundamentos: s.anchors,
      conteudo: s.blocks
        .filter((b) => b.type === "paragraph")
        .map((b) => (b.type === "paragraph" ? b.text : ""))
        .join("\n\n"),
      dispensada: !!s.skipped,
      justificativaDispensa: s.skipped?.justification,
    })),
  };

  return Buffer.from(JSON.stringify(payload, null, 2), "utf8");
}
