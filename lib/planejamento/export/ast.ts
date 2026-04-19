/**
 * AST intermediária para exportação de documentos de Planejamento.
 *
 * A decisão de arquitetura é renderizar todos os formatos (HTML-SEI, docx,
 * pdf, pncp-metadata) a partir desta árvore única. Ganhos:
 *   - diff/consistência entre formatos em um único lugar;
 *   - marcação semântica de citações (útil para destacar em pdf/docx);
 *   - adapta-se à mesma estrutura produzida pelo ETP e pelo TR.
 */

export interface ASTDocument {
  title: string;
  kind: "ETP" | "TR";
  subtitle?: string;
  metadata: Record<string, string | undefined>;
  sections: ASTSection[];
  decision?: ASTDecision;
}

export interface ASTSection {
  ordem: number;
  title: string;
  /** Ancoras normativas da seção — renderizadas como chips/rodapé */
  anchors: string[];
  blocks: ASTBlock[];
  /** Observações operacionais (ex: "dispensada com justificativa") */
  statusNote?: string;
  /** Quando a seção foi dispensada */
  skipped?: { justification: string };
}

export type ASTBlock = ASTParagraph | ASTCitationsFooter;

export interface ASTParagraph {
  type: "paragraph";
  text: string;
}

export interface ASTCitationsFooter {
  type: "citations-footer";
  label: string;
  items: Array<{ label: string; url?: string }>;
}

export interface ASTDecision {
  matrixSlug: string;
  matrixVersion: number;
  modalidade: string;
  criterio: string;
  rationale: string;
  citations: string[];
  executedAt?: string;
}
