/**
 * Orquestrador de exportação: recebe um `PlanningDocument` + trilha + última
 * execução da matriz, constrói a AST uma vez e produz os artefatos nos
 * formatos solicitados, já empacotados para upload (buffer + contentType +
 * extension).
 */
import type { ASTDocument } from "./ast";
import type { PlanningExportFormat } from "@/data/planejamento/types";
import { buildAST, type BuildASTInput } from "./from-document";
import { renderHtmlSei } from "./renderers/html-sei";
import { renderDocx } from "./renderers/docx";
import { renderPdf } from "./renderers/pdf";
import { renderPncpMetadata } from "./renderers/pncp-metadata";

export interface ExportArtifact {
  format: PlanningExportFormat;
  buffer: Buffer;
  contentType: string;
  extension: string;
}

export async function exportArtifacts(
  input: BuildASTInput,
  formats: PlanningExportFormat[],
): Promise<{ ast: ASTDocument; artifacts: ExportArtifact[] }> {
  const ast = buildAST(input);
  const artifacts: ExportArtifact[] = [];

  for (const fmt of formats) {
    switch (fmt) {
      case "html-sei": {
        const html = renderHtmlSei(ast);
        artifacts.push({
          format: "html-sei",
          buffer: Buffer.from(html, "utf8"),
          contentType: "text/html; charset=utf-8",
          extension: "html",
        });
        break;
      }
      case "docx": {
        const buffer = await renderDocx(ast);
        artifacts.push({
          format: "docx",
          buffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          extension: "docx",
        });
        break;
      }
      case "pdf": {
        const buffer = renderPdf(ast);
        artifacts.push({
          format: "pdf",
          buffer,
          contentType: "application/pdf",
          extension: "pdf",
        });
        break;
      }
      case "pncp-metadata": {
        artifacts.push({
          format: "pncp-metadata",
          buffer: renderPncpMetadata(ast),
          contentType: "application/json",
          extension: "json",
        });
        break;
      }
      default: {
        const exhaustive: never = fmt;
        throw new Error(`Formato não suportado: ${exhaustive as string}`);
      }
    }
  }

  return { ast, artifacts };
}

export { buildAST } from "./from-document";
export type { ASTDocument } from "./ast";
