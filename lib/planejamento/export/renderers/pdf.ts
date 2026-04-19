/**
 * Renderer PDF a partir da AST. Usa `jspdf` em modo server-side
 * (sem DOM — apenas texto fluido).
 *
 * Limitações propositais para MVP:
 *  - Fonte Helvetica padrão (não embute Cinzel/Poppins — evita dependência
 *    de arquivos de fonte adicionais no pacote).
 *  - Sem table, sem imagem; quebras manuais de página.
 *  - Citações aparecem como links embutidos por jsPDF.
 */
import { jsPDF } from "jspdf";
import type { ASTDocument, ASTSection } from "../ast";

const MARGIN = 15; // mm
const PAGE_WIDTH = 210; // A4
const PAGE_HEIGHT = 297;
const USABLE = PAGE_WIDTH - MARGIN * 2;
const BRAND: [number, number, number] = [32, 54, 78];
const TEXT: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [107, 114, 128];

export function renderPdf(doc: ASTDocument): Buffer {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const state = { y: MARGIN, pdf };

  setFont(pdf, 22, "bold", BRAND);
  writeText(state, doc.title, { leading: 9 });
  state.y += 2;

  if (doc.subtitle) {
    setFont(pdf, 10, "italic", MUTED);
    writeText(state, `${doc.kind} · ${doc.subtitle}`, { leading: 5 });
  }
  state.y += 4;

  if (doc.decision) {
    heading(state, "Modalidade e critério de julgamento");
    setFont(state.pdf, 11, "normal", TEXT);
    writeText(
      state,
      `Modalidade: ${doc.decision.modalidade}. Critério: ${doc.decision.criterio}.`,
      { leading: 5 },
    );
    writeText(state, doc.decision.rationale, { leading: 5 });
    setFont(state.pdf, 9, "italic", MUTED);
    writeText(state, `Fundamento: ${doc.decision.citations.join("; ")}.`, {
      leading: 4.5,
    });
    state.y += 3;
  }

  for (const s of doc.sections) {
    renderSection(state, s);
  }

  const bytes = pdf.output("arraybuffer");
  return Buffer.from(bytes);
}

function renderSection(state: { y: number; pdf: jsPDF }, s: ASTSection) {
  heading(state, `${s.ordem}. ${s.title}`);

  if (s.anchors.length > 0) {
    setFont(state.pdf, 8.5, "normal", MUTED);
    writeText(state, s.anchors.join(" · "), { leading: 4 });
  }
  if (s.statusNote) {
    setFont(state.pdf, 9, "italic", BRAND);
    writeText(state, s.statusNote, { leading: 4 });
  }

  for (const b of s.blocks) {
    if (b.type === "paragraph") {
      setFont(state.pdf, 11, "normal", TEXT);
      writeText(state, b.text, { leading: 5.2, paragraphGap: 2 });
    } else if (b.type === "citations-footer") {
      setFont(state.pdf, 9, "italic", MUTED);
      writeText(state, `${b.label}:`, { leading: 4 });
      setFont(state.pdf, 9, "normal", TEXT);
      for (const item of b.items) {
        writeText(state, `• ${item.label}${item.url ? " — " + item.url : ""}`, {
          leading: 4,
          indent: 4,
        });
      }
    }
  }
  state.y += 2;
}

function heading(state: { y: number; pdf: jsPDF }, text: string) {
  ensureSpace(state, 14);
  state.y += 4;
  setFont(state.pdf, 14, "bold", BRAND);
  writeText(state, text, { leading: 6 });
}

function writeText(
  state: { y: number; pdf: jsPDF },
  text: string,
  opts: { leading: number; paragraphGap?: number; indent?: number } = {
    leading: 5,
  },
) {
  const indent = opts.indent ?? 0;
  const maxWidth = USABLE - indent;
  const lines = state.pdf.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    ensureSpace(state, opts.leading);
    state.pdf.text(line, MARGIN + indent, state.y);
    state.y += opts.leading;
  }
  if (opts.paragraphGap) state.y += opts.paragraphGap;
}

function ensureSpace(state: { y: number; pdf: jsPDF }, needed: number) {
  if (state.y + needed > PAGE_HEIGHT - MARGIN) {
    state.pdf.addPage();
    state.y = MARGIN;
  }
}

function setFont(
  pdf: jsPDF,
  size: number,
  weight: "normal" | "bold" | "italic",
  color: [number, number, number],
) {
  pdf.setFont(
    "helvetica",
    weight === "bold" ? "bold" : weight === "italic" ? "italic" : "normal",
  );
  pdf.setFontSize(size);
  pdf.setTextColor(color[0], color[1], color[2]);
}
